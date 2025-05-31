import express, { Request, Response } from 'express'
const messages = require('./routes/message');

const app = express()
const PORT = process.env.PORT || 5000

app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.send('Hello from echo-backend!')
})

app.use('/message', messages);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
