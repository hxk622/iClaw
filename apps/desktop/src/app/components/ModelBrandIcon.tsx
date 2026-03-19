import type { ModelFamily } from '../lib/model-catalog';

type ModelBrandIconProps = {
  family: ModelFamily;
  className?: string;
};

export function ModelBrandIcon({ family, className }: ModelBrandIconProps) {
  switch (family) {
    case 'gpt':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
          <rect width="24" height="24" rx="7" fill="#111111" />
          <path
            fill="none"
            stroke="#ffffff"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
            d="M11.94 5.15a3.64 3.64 0 0 1 3.28 1.9l1.31.02a3.27 3.27 0 0 1 2.8 4.9 3.38 3.38 0 0 1-.29 4.58 3.28 3.28 0 0 1-4.43 2.97 3.64 3.64 0 0 1-5.19 0 3.27 3.27 0 0 1-4.43-2.97 3.38 3.38 0 0 1-.28-4.58 3.27 3.27 0 0 1 2.79-4.9l1.31-.02a3.64 3.64 0 0 1 3.13-1.9Zm-2.78 3.18 5.68 9.82m-5.81-1.62h11.32m-8.54-8.2h5.68l2.84 4.92-2.84 4.92h-5.68l-2.84-4.92Z"
          />
        </svg>
      );
    case 'claude':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
          <rect width="24" height="24" rx="7" fill="#E9D8C5" />
          <path
            fill="#201A16"
            d="M12.09 5.2c3.8 0 5.82 2.04 5.82 5.36 0 3.42-2.2 5.52-5.95 5.52H9.95V19H7V5.2h5.09Zm-.4 8.23c2 0 3.18-1 3.18-2.82 0-1.75-1.09-2.68-3.11-2.68H9.95v5.5h1.74Z"
          />
        </svg>
      );
    case 'gemini':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
          <rect width="24" height="24" rx="7" fill="#F3F7FF" />
          <path fill="#4C8DF6" d="M12 4.2 13.47 9.08 18.8 11 13.47 12.92 12 17.8 10.53 12.92 5.2 11 10.53 9.08 12 4.2Z" />
          <path fill="#9B5CF7" d="M12 7.1 13.02 10.47 16.4 11.7 13.02 12.93 12 16.3 10.98 12.93 7.6 11.7 10.98 10.47 12 7.1Z" />
        </svg>
      );
    case 'grok':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
          <rect width="24" height="24" rx="7" fill="#111111" />
          <path
            fill="none"
            stroke="#ffffff"
            strokeLinecap="round"
            strokeWidth="2.1"
            d="M7.2 7.2 16.8 16.8M16.8 7.2 9.7 14.3M13.3 9.1h3.5v3.5"
          />
        </svg>
      );
    case 'qwen':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
          <path
            fill="none"
            stroke="#6C5CFF"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.1"
            d="M7.8 8.2 12 5.8l4.2 2.4v4.7L12 15.3l-4.2-2.4V8.2Z"
          />
          <path
            fill="none"
            stroke="#6C5CFF"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.1"
            d="m9.2 9.9 2.8 4.9 2.8-4.9M9.2 14.1H14.8"
          />
        </svg>
      );
    case 'minimax':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
          <path
            fill="none"
            stroke="#FF4B77"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.2"
            d="M4.6 15.6v-4.2m3.2 7.1V8.5m3.2 8.1V7.4m3.2 6.9V9.7m3.2 5.3v-6"
          />
        </svg>
      );
    case 'deepseek':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
          <rect width="24" height="24" rx="7" fill="#EEF5FF" />
          <path
            fill="#2F7BFF"
            d="M6 13.6c1.38-3.43 4.12-5.43 8.2-5.96 1.15-.15 2.29-.08 3.42.22-.97.26-1.72.85-2.27 1.78 1.02.09 1.94.47 2.76 1.15-.8.12-1.46.42-1.99.92a4.76 4.76 0 0 1-2.95 1.3c.88.57 1.8 1 2.75 1.28-.88.53-1.9.8-3.07.8-1.48 0-2.84-.44-4.08-1.31-.77-.54-1.69-.94-2.77-1.19Z"
          />
        </svg>
      );
    case 'kimi':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
          <path fill="#111111" d="M6.2 5.5h2.9v5.37l5.7-5.37h3.88l-6.28 5.92 6.63 7.08h-3.98L9.1 13.94v4.56H6.2V5.5Z" />
          <circle cx="18.4" cy="5.8" r="1.6" fill="#4285FF" />
        </svg>
      );
    case 'doubao':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
          <path fill="#8B5CF6" d="M12 4.7a7.2 7.2 0 0 1 4.68 1.72l-1.66 1.72A4.8 4.8 0 0 0 7.2 12a4.8 4.8 0 0 0 4.8 4.9h1.08v2.4H12a7.3 7.3 0 0 1 0-14.6Z" />
          <path fill="#5B8CFF" d="M16.68 6.42A7.25 7.25 0 0 1 19.3 12a7.2 7.2 0 0 1-1.6 4.55l-1.94-1.15A4.85 4.85 0 0 0 16.9 12c0-1.36-.57-2.58-1.48-3.46l1.26-2.12Z" />
          <path fill="#34D399" d="M12 7.95h1.08v8.1H12a4.05 4.05 0 1 1 0-8.1Z" />
        </svg>
      );
    case 'glm':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
          <path fill="#111111" d="M5.4 6h13.2v2.4l-9.2 7.2h9.2V18H5.4v-2.4l9.16-7.2H5.4V6Z" />
        </svg>
      );
    case 'mistral':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
          <rect width="24" height="24" rx="7" fill="#FFF3E8" />
          <path fill="#FF6A00" d="M6 6h3v3H6zm4.5 0h3v3h-3zm4.5 0h3v3h-3zM6 10.5h3v3H6zm4.5 0h3v7.5h-3zm4.5 0h3v3h-3zM6 15h3v3H6zm9 0h3v3h-3z" />
        </svg>
      );
    case 'llama':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
          <rect width="24" height="24" rx="7" fill="#F6F1FF" />
          <path
            fill="none"
            stroke="#6D4AFF"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M7 17.2V8.7c0-1.57 1.27-2.84 2.84-2.84.76 0 1.49.3 2.02.84l.14.14.14-.14a2.86 2.86 0 0 1 4.88 2.02v8.5"
          />
        </svg>
      );
    default:
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
          <rect width="24" height="24" rx="7" fill="#F3F4F6" />
          <path
            fill="none"
            stroke="#4B5563"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="m12 5.4 1.34 3.26L16.6 10l-3.26 1.34L12 14.6l-1.34-3.26L7.4 10l3.26-1.34L12 5.4Z"
          />
        </svg>
      );
  }
}
