import type { NextApiRequest, NextApiResponse } from 'next'
import multer from 'multer'
import nextConnect from 'next-connect'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
})

const upload = multer({
  storage: multer.memoryStorage(),
})

const apiRoute = nextConnect({
  onError(error, req: NextApiRequest, res: NextApiResponse) {
    res.status(501).json({ error: `Sorry something Happened! ${error.message}` })
  },
  onNoMatch(req: NextApiRequest, res: NextApiResponse) {
    res.status(405).json({ error: `Method '${req.method}' Not Allowed` })
  },
})

apiRoute.use(upload.single('file'))

apiRoute.post(async (req: NextApiRequest & { file: Express.Multer.File }, res: NextApiResponse) => {
  const fileBuffer = req.file.buffer
  const fileId = (
    await openai.files.create({
      file: fileBuffer,
      purpose: "assistants",
    })
  ).id

  res.status(200).json({ data: 'success', fileId })
})

export default apiRoute

export const config = {
  api: {
    bodyParser: false,
  },
}
