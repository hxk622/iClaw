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
          <rect width="24" height="24" rx="7" fill="#F6F4FF" />
          <path
            fill="none"
            stroke="#4E7BFF"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 6.2a5.8 5.8 0 1 0 4.1 9.9"
          />
          <path
            fill="none"
            stroke="#9C4DFF"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="m16.1 16.1 1.7 1.7m-3.05-5.3a2.75 2.75 0 1 1-5.5 0 2.75 2.75 0 0 1 5.5 0Z"
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
          <rect width="24" height="24" rx="7" fill="#EEF5FF" />
          <path fill="#2477FF" d="M7 5.6h2.8v5.08L14 5.6h3.52l-4.83 5.61 5.27 7.19H14.4l-3.62-4.95-.98 1.14v3.81H7V5.6Z" />
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
