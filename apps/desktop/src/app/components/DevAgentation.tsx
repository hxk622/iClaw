import { createRoot, type Root } from 'react-dom/client';
import { Agentation } from 'agentation';

let agentationRoot: Root | null = null;

export function mountDevAgentation(container: HTMLElement): void {
  if (!agentationRoot) {
    agentationRoot = createRoot(container);
  }

  agentationRoot.render(<Agentation />);
}
