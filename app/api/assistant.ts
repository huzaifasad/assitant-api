import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import multiparty from 'multiparty';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).end(); // Method Not Allowed
    return;
  }

  try {
    const form = new multiparty.Form();

    form.parse(req, async (err, fields, files) => {
      if (err) {
        res.status(500).json({ error: 'Error parsing form data' });
        return;
      }

      const { message } = fields;
      const file = files.file?.[0];

      let fileId;
      if (file) {
        const fileStream = fs.createReadStream(file.path);
        const uploadedFile = await openai.files.create({
          file: fileStream,
          purpose: "assistants",
        });
        fileId = uploadedFile.id;
      }

      // Create a thread and add a message
      const thread = await openai.beta.threads.create({
        messages: [
          {
            role: 'user',
            content: message[0],
            attachments: fileId ? [{ file_id: fileId, tools: [{ type: "code_interpreter" }] }] : [],
          },
        ],
      });

      // Run the assistant on the thread
      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: process.env.ASSISTANT_ID,
      });

      // Wait for the run to complete
      async function waitForRunCompletion(run) {
        while (run.status === 'queued' || run.status === 'in_progress') {
          await new Promise((resolve) => setTimeout(resolve, 500));
          run = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        }
        return run;
      }

      const completedRun = await waitForRunCompletion(run);

      if (completedRun.status === 'completed') {
        const responseMessages = (await openai.beta.threads.messages.list(thread.id, {
          after: thread.messages[0].id,
          order: 'asc',
        })).data;

        res.status(200).json({
          threadId: thread.id,
          messages: responseMessages.map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content.map((c) => c.type === 'text' ? c.text : '').join(''),
          })),
        });
      } else {
        res.status(500).json({ error: 'Run failed' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
