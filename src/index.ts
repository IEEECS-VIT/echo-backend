import 'dotenv/config';
import express, { Request, Response } from 'express'
import './client/supabase'
import { checkBucketConnection } from './lib/storage'

const app = express()
const PORT = process.env.PORT || 5000

checkBucketConnection().catch(console.error)

app.get('/', (_req: Request, res: Response) => {
  res.send('Hello from echo-backend!')
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
