// import { Request, Response, NextFunction } from 'express';

// export const submitContactForm = async (req: Request,res: Response,next: NextFunction): Promise<void> => {
//   try {
//     const { name, email, message } = req.body;

//     if (!name || !email || !message) {
//       res.status(400).json({ error: "All fields are required" });
//       return;
//     }

//     console.log("contact form: ", { name, email, message });

//     res.status(200).json({ success: true, message: "received" });
//   } catch (error) {
//     console.error("Contact form error:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// };
import { Request, Response, NextFunction } from 'express';
import { supabase } from '../client/supabase';

export const submitContactForm = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      res.status(400).json({ error: "All fields are required" });
      return;
    }


    const { data, error } = await supabase
      .from('contact_form') 
      .insert([{ name, email, message }]);
      // .select();

    if (error) {
      console.error("Supabase insert error:", error);
      res.status(500).json({ error: "Failed to save contact form" });
      return;
    }

    console.log("Contact form saved:", data);

    res.status(200).json({ success: true, message: "Form saved!", data });
  } catch (error) {
    console.error("Contact form error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

