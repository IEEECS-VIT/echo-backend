/**
 * Push Notification Service
 *
 * Sends notifications via Expo Push API.
 * Calls are fire-and-forget and should never block message delivery.
 */

import { supabase } from '../client/supabase';
import { checkChannelAccess } from '../controllers/channelController';
import { getUserSocket } from '../redis/userSocketStore';
import { userSocketMap } from '../sockets/chatSocket';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH_SIZE = 100;

const EXPO_TOKEN_RE = /^ExponentPushToken\[[^\]]+\]$|^ExpoPushToken\[[^\]]+\]$/;

type PushMessage = {
  to: string;
  title: string;
  subtitle?: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
};

const MAX_PREVIEW_MESSAGES = 3;
const PREVIEW_LINE_MAX = 90;
const PREVIEW_BODY_MAX = 360;

function isExpoPushToken(token: string): boolean {
  return EXPO_TOKEN_RE.test(token);
}

function uniqueValidTokens(tokens: Array<string | null | undefined>): string[] {
  const unique = new Set<string>();
  for (const token of tokens) {
    if (typeof token !== 'string') continue;
    const trimmed = token.trim();
    if (!trimmed) continue;
    if (!isExpoPushToken(trimmed)) continue;
    unique.add(trimmed);
  }
  return Array.from(unique);
}

async function removeInvalidTokensFromDb(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;

  const uniqueTokens = Array.from(new Set(tokens));
  const { error } = await supabase
    .from('user_push_tokens')
    .delete()
    .in('push_token', uniqueTokens);

  if (error) {
    console.error('[PushNotification] Failed to remove invalid tokens:', error.message);
    return;
  }

  console.log(`[PushNotification] Removed ${uniqueTokens.length} invalid push token(s) from DB`);
}

/**
 * Fetch all push tokens for a user from the user_push_tokens table.
 */
async function getTokensForUser(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_push_tokens')
    .select('push_token')
    .eq('user_id', userId);

  if (error) {
    console.error('[PushNotification] Error fetching tokens for user:', userId, error.message);
    return [];
  }

  return uniqueValidTokens((data || []).map((row: any) => row.push_token));
}

/**
 * Fetch username by user ID.
 */
async function getUsername(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('users')
    .select('username')
    .eq('id', userId)
    .single();

  if (error || !data) return 'Someone';
  return data.username || 'Someone';
}

function normalizeMediaUrls(mediaUrl: unknown): string[] {
  if (typeof mediaUrl !== 'string') return [];
  const trimmed = mediaUrl.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === 'string' && item.trim().length > 0);
      }
    } catch {
      return [trimmed];
    }
  }

  return [trimmed];
}

function toSingleLine(value: string, maxLen = PREVIEW_LINE_MAX): string {
  const oneLine = value.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, Math.max(0, maxLen - 3)).trimEnd()}...`;
}

function previewFromMessage(content: unknown, mediaUrl: unknown): string {
  const text = typeof content === 'string' ? content.trim() : '';
  if (text) return toSingleLine(text);

  const mediaUrls = normalizeMediaUrls(mediaUrl);
  if (mediaUrls.length > 0) return 'Sent an attachment';
  return 'New message';
}

function buildPreviewBody(lines: string[]): string {
  const normalized = lines
    .map((line) => toSingleLine(line))
    .filter((line) => line.length > 0)
    .slice(-MAX_PREVIEW_MESSAGES);

  if (normalized.length === 0) return 'New message';

  let body = normalized.join('\n');
  if (body.length <= PREVIEW_BODY_MAX) return body;
  body = body.slice(0, PREVIEW_BODY_MAX - 3).trimEnd();
  return `${body}...`;
}

async function getLatestDmPreviewLines(threadId: string, senderId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('dm_messages')
    .select('content, media_url, timestamp')
    .eq('thread_id', threadId)
    .eq('sender_id', senderId)
    .order('timestamp', { ascending: false })
    .limit(MAX_PREVIEW_MESSAGES);

  if (error || !data || data.length === 0) return [];

  return data
    .slice()
    .reverse()
    .map((msg: any) => previewFromMessage(msg.content, msg.media_url));
}

async function getLatestChannelPreviewLines(channelId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      content,
      media_url,
      timestamp,
      sender:users!sender_id (
        username
      )
    `)
    .eq('channel_id', channelId)
    .order('timestamp', { ascending: false })
    .limit(MAX_PREVIEW_MESSAGES);

  if (error || !data || data.length === 0) return [];

  return data
    .slice()
    .reverse()
    .map((msg: any) => {
      const senderName = msg?.sender?.username || 'Someone';
      const preview = previewFromMessage(msg?.content, msg?.media_url);
      return `${toSingleLine(senderName, 24)}: ${preview}`;
    });
}

/**
 * Send push notifications to a list of Expo push tokens.
 * Supports batching (Expo allows up to 100 messages per request).
 */
async function sendExpoPush(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const chunks: PushMessage[][] = [];
  for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
    chunks.push(messages.slice(i, i + EXPO_BATCH_SIZE));
  }

  for (const chunk of chunks) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('[PushNotification] Expo Push API error:', response.status, text);
        continue;
      }

      const payload = await response.json().catch(() => null);
      const tickets = Array.isArray(payload?.data) ? payload.data : [];
      const invalidTokens: string[] = [];

      for (let i = 0; i < tickets.length && i < chunk.length; i += 1) {
        const ticket = tickets[i];
        if (ticket?.status !== 'error') continue;

        const ticketError = ticket?.message || ticket?.details?.error || 'unknown_error';
        console.error('[PushNotification] Expo ticket error:', ticketError);

        // Expo recommends removing DeviceNotRegistered tokens.
        if (ticket?.details?.error === 'DeviceNotRegistered') {
          invalidTokens.push(chunk[i].to);
        }
      }

      if (invalidTokens.length > 0) {
        await removeInvalidTokensFromDb(invalidTokens);
      }

      console.log(`[PushNotification] Sent ${chunk.length} notification(s)`);
    } catch (err: any) {
      console.error('[PushNotification] Failed to call Expo Push API:', err?.message || err);
    }
  }
}

/**
 * Send a push notification to a DM recipient.
 * Should be called after a DM is saved and emitted via socket.
 */
export async function sendDmPushNotification(
  senderId: string,
  receiverId: string,
  messagePreview: string,
  threadId?: string
): Promise<void> {
  try {
    const tokens = await getTokensForUser(receiverId);
    if (tokens.length === 0) {
      console.log(`[PushNotification] No push tokens for DM receiver ${receiverId}`);
      return;
    }

    const senderName = await getUsername(senderId);

    let previewLines: string[] = [];
    if (threadId) {
      previewLines = await getLatestDmPreviewLines(threadId, senderId);
    }
    if (previewLines.length === 0) {
      previewLines = [previewFromMessage(messagePreview, null)];
    }

    const body = buildPreviewBody(previewLines);
    const messageCount = previewLines.length;

    const messages: PushMessage[] = tokens.map((token) => ({
      to: token,
      title: senderName,
      ...(messageCount > 1 ? { subtitle: `${messageCount} new messages` } : {}),
      body,
      sound: 'default',
      data: {
        type: 'dm',
        senderId,
        receiverId,
        threadId: threadId || null,
        groupKey: `dm:${senderId}`,
        previewLines: previewLines.slice(-MAX_PREVIEW_MESSAGES),
      },
    }));

    await sendExpoPush(messages);
  } catch (err: any) {
    console.error('[PushNotification] sendDmPushNotification error:', err?.message || err);
  }
}

/**
 * Send push notifications to offline members of a channel when a new message is sent.
 */
export async function sendChannelPushNotification(
  senderId: string,
  channelId: string,
  messagePreview: string
): Promise<void> {
  try {
    // 1) Get channel info.
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('name, server_id')
      .eq('id', channelId)
      .single();

    if (channelError || !channel) {
      console.error('[PushNotification] Could not find channel:', channelId, channelError?.message);
      return;
    }

    // 2) Get server members except sender.
    const { data: members, error: membersError } = await supabase
      .from('server_members')
      .select('user_id')
      .eq('server_id', channel.server_id)
      .neq('user_id', senderId);

    if (membersError || !members || members.length === 0) {
      return;
    }

    // 3) Keep only offline members.
    const offlineUserIds: string[] = [];
    for (const member of members) {
      const localSocket = userSocketMap.get(member.user_id);
      if (localSocket) continue;

      let redisSocket: string | null = null;
      try {
        redisSocket = await getUserSocket(member.user_id);
      } catch (error: any) {
        console.warn('[PushNotification] Redis socket lookup failed:', error?.message || error);
      }

      if (redisSocket) continue;
      offlineUserIds.push(member.user_id);
    }

    if (offlineUserIds.length === 0) {
      console.log('[PushNotification] All channel members are online, skipping push');
      return;
    }

    // 4) Respect channel visibility rules (avoid notifying users with no access).
    const allowedOfflineUserIds: string[] = [];
    for (const userId of offlineUserIds) {
      try {
        const canView = await checkChannelAccess(userId, channelId);
        if (canView) allowedOfflineUserIds.push(userId);
      } catch (error: any) {
        console.warn('[PushNotification] Channel access check failed:', error?.message || error);
      }
    }

    if (allowedOfflineUserIds.length === 0) {
      console.log('[PushNotification] No offline users have access to this channel');
      return;
    }

    // 5) Fetch push tokens for eligible users.
    const { data: tokenRows, error: tokenError } = await supabase
      .from('user_push_tokens')
      .select('push_token')
      .in('user_id', allowedOfflineUserIds);

    if (tokenError || !tokenRows || tokenRows.length === 0) {
      console.log('[PushNotification] No push tokens for eligible channel members');
      return;
    }

    const tokens = uniqueValidTokens(tokenRows.map((row: any) => row.push_token));
    if (tokens.length === 0) return;

    // 6) Build and send push messages.
    const channelName = channel.name || 'channel';
    let previewLines = await getLatestChannelPreviewLines(channelId);

    if (previewLines.length === 0) {
      const senderName = await getUsername(senderId);
      const fallbackPreview = previewFromMessage(messagePreview, null);
      previewLines = [`${toSingleLine(senderName, 24)}: ${fallbackPreview}`];
    }

    const body = buildPreviewBody(previewLines);
    const messageCount = previewLines.length;

    const messages: PushMessage[] = tokens.map((token) => ({
      to: token,
      title: `#${channelName}`,
      ...(messageCount > 1 ? { subtitle: `${messageCount} new messages` } : {}),
      body,
      sound: 'default',
      data: {
        type: 'channel_message',
        channelId,
        serverId: channel.server_id,
        groupKey: `channel:${channelId}`,
        previewLines: previewLines.slice(-MAX_PREVIEW_MESSAGES),
      },
    }));

    await sendExpoPush(messages);
  } catch (err: any) {
    console.error('[PushNotification] sendChannelPushNotification error:', err?.message || err);
  }
}
