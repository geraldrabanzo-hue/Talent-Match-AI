import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set up pdfjs worker using Vite's built-in worker support
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export const extractTextFromFile = async (file: File): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'pdf') {
    return extractTextFromPDF(file);
  } else if (extension === 'docx' || extension === 'doc') {
    return extractTextFromWord(file);
  } else if (['jpg', 'jpeg', 'png'].includes(extension || '')) {
    // For images, we just return the name for now or could use OCR if available
    return `Candidate Image CV: ${file.name}`;
  }

  return "";
};

const extractTextFromPDF = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => item.str);
    fullText += strings.join(" ") + "\n";
  }

  return fullText;
};

const extractTextFromWord = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
};
