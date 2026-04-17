declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export function getDocument(input: any): {
    promise: Promise<{
      numPages: number;
      getPage: (
        pageNumber: number,
      ) => Promise<{
        getTextContent: () => Promise<{
          items: Array<{ str?: string }>;
        }>;
        getViewport: (input: { scale: number }) => {
          width: number;
          height: number;
        };
        render: (input: unknown) => {
          promise: Promise<void>;
        };
      }>;
    }>;
  };
}
