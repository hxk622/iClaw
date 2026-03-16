import {
  ArrowUp,
  ChevronDown,
  Film,
  FileText,
  Eye,
  Image as ImageIcon,
  Layers,
  Plus,
  Sparkles,
  Square,
  WandSparkles,
  Zap,
  Search,
} from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

export type OpenClawImageAttachment = {
  id: string;
  dataUrl: string;
  mimeType: string;
};

export type ComposerSendPayload = {
  prompt: string;
  imageAttachments: OpenClawImageAttachment[];
};

export type RichChatComposerHandle = {
  focus: () => void;
  insertReference: (
    text: string,
    options?: {
      label?: string;
      trailingText?: string;
    },
  ) => void;
};

type ComposerTokenMeta = {
  id: string;
  kind: 'reference' | 'attachment';
  label: string;
  value: string;
  mimeType?: string;
  dataUrl?: string | null;
};

type RichChatComposerProps = {
  connected: boolean;
  busy: boolean;
  onAbort: () => Promise<void> | void;
  onSend: (payload: ComposerSendPayload) => Promise<boolean> | boolean;
};

const SUPPORTED_ATTACHMENT_TYPES = ['image/', 'video/', 'application/pdf'];
const PLACEHOLDER = '输入问题...';

function createComposerId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isSupportedAttachment(file: File): boolean {
  return SUPPORTED_ATTACHMENT_TYPES.some((type) => file.type.startsWith(type));
}

function isImageAttachment(mimeType?: string): boolean {
  return typeof mimeType === 'string' && mimeType.startsWith('image/');
}

function isVideoAttachment(mimeType?: string): boolean {
  return typeof mimeType === 'string' && mimeType.startsWith('video/');
}

function isPdfAttachment(mimeType?: string): boolean {
  return mimeType === 'application/pdf';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('failed to read file')));
    reader.readAsDataURL(file);
  });
}

function buildTokenMarker(token: ComposerTokenMeta): string {
  if (token.kind === 'reference') {
    return `[[引用:${token.value}]]`;
  }
  if (isImageAttachment(token.mimeType)) {
    return `[[图片:${token.label}]]`;
  }
  if (isPdfAttachment(token.mimeType)) {
    return `[[PDF:${token.label}]]`;
  }
  if (isVideoAttachment(token.mimeType)) {
    return `[[视频:${token.label}]]`;
  }
  return `[[附件:${token.label}]]`;
}

function buildTokenTone(token: ComposerTokenMeta): string {
  if (token.kind === 'reference') return 'reference';
  if (isImageAttachment(token.mimeType)) return 'image';
  if (isPdfAttachment(token.mimeType)) return 'pdf';
  if (isVideoAttachment(token.mimeType)) return 'video';
  return 'file';
}

function buildTokenBadge(token: ComposerTokenMeta): string {
  if (token.kind === 'reference') return '引';
  if (isImageAttachment(token.mimeType)) return '图';
  if (isPdfAttachment(token.mimeType)) return 'PDF';
  if (isVideoAttachment(token.mimeType)) return '影';
  return '附';
}

function createTokenElement(token: ComposerTokenMeta): HTMLSpanElement {
  const element = document.createElement('span');
  element.className = 'iclaw-inline-token';
  element.dataset.tokenId = token.id;
  element.dataset.tokenKind = token.kind;
  element.dataset.tokenTone = buildTokenTone(token);
  element.contentEditable = 'false';

  const badge = document.createElement('span');
  badge.className = 'iclaw-inline-token__badge';
  badge.textContent = buildTokenBadge(token);

  const label = document.createElement('span');
  label.className = 'iclaw-inline-token__label';
  label.textContent = token.label;

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'iclaw-inline-token__remove';
  remove.dataset.tokenRemove = 'true';
  remove.setAttribute('aria-label', '移除引用块');
  remove.textContent = '×';

  element.append(badge, label, remove);
  return element;
}

function normalizePrompt(prompt: string): string {
  return prompt
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function createRangeAtEnd(root: HTMLElement): Range {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  return range;
}

function serializeEditor(
  root: HTMLDivElement,
  tokenStore: Map<string, ComposerTokenMeta>,
): ComposerSendPayload & { hasContent: boolean } {
  const imageAttachments: OpenClawImageAttachment[] = [];
  let prompt = '';

  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      prompt += node.textContent ?? '';
      return;
    }

    if (!(node instanceof HTMLElement)) {
      return;
    }

    if (node.dataset.tokenId) {
      const token = tokenStore.get(node.dataset.tokenId);
      if (!token) {
        return;
      }
      prompt += buildTokenMarker(token);
      if (token.kind === 'attachment' && isImageAttachment(token.mimeType) && token.dataUrl) {
        imageAttachments.push({
          id: token.id,
          dataUrl: token.dataUrl,
          mimeType: token.mimeType ?? 'image/png',
        });
      }
      return;
    }

    if (node.tagName === 'BR') {
      prompt += '\n';
      return;
    }

    node.childNodes.forEach(visit);
  };

  root.childNodes.forEach(visit);

  const normalizedPrompt = normalizePrompt(prompt);
  return {
    prompt: normalizedPrompt,
    imageAttachments,
    hasContent: normalizedPrompt.length > 0 || imageAttachments.length > 0,
  };
}

function buildReferenceLabel(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= 34) {
    return collapsed;
  }
  return `${collapsed.slice(0, 33)}...`;
}

export const RichChatComposer = forwardRef<RichChatComposerHandle, RichChatComposerProps>(
  function RichChatComposer({ connected, busy, onAbort, onSend }, ref) {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const tokenStoreRef = useRef<Map<string, ComposerTokenMeta>>(new Map());
    const savedRangeRef = useRef<Range | null>(null);
    const [hasContent, setHasContent] = useState(false);
    const [tokenCount, setTokenCount] = useState(0);

    const refreshState = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }
      const snapshot = serializeEditor(editor, tokenStoreRef.current);
      setHasContent(snapshot.hasContent);
      setTokenCount(tokenStoreRef.current.size);
      editor.dataset.empty = snapshot.hasContent ? 'false' : 'true';
    }, []);

    const restoreRange = useCallback((): Range | null => {
      const editor = editorRef.current;
      if (!editor) {
        return null;
      }
      editor.focus();
      const selection = window.getSelection();
      if (!selection) {
        return null;
      }
      const preferredRange = savedRangeRef.current?.cloneRange() ?? createRangeAtEnd(editor);
      selection.removeAllRanges();
      try {
        selection.addRange(preferredRange);
        return preferredRange;
      } catch {
        const fallbackRange = createRangeAtEnd(editor);
        selection.removeAllRanges();
        selection.addRange(fallbackRange);
        return fallbackRange;
      }
    }, []);

    const placeCaretAfter = useCallback((node: Node) => {
      const selection = window.getSelection();
      if (!selection) {
        return;
      }
      const range = document.createRange();
      range.setStartAfter(node);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      savedRangeRef.current = range.cloneRange();
    }, []);

    const insertFragmentAtCaret = useCallback(
      (fragment: DocumentFragment, lastNode: Node | null) => {
        const range = restoreRange();
        if (!range) {
          return;
        }
        range.deleteContents();
        range.insertNode(fragment);
        if (lastNode) {
          placeCaretAfter(lastNode);
        }
        refreshState();
      },
      [placeCaretAfter, refreshState, restoreRange],
    );

    const insertTextAtCaret = useCallback(
      (text: string) => {
        if (!text) {
          return;
        }
        const fragment = document.createDocumentFragment();
        let lastNode: Node | null = null;
        const segments = text.replace(/\r\n/g, '\n').split('\n');
        segments.forEach((segment, index) => {
          if (segment.length > 0) {
            lastNode = document.createTextNode(segment);
            fragment.append(lastNode);
          }
          if (index < segments.length - 1) {
            lastNode = document.createElement('br');
            fragment.append(lastNode);
          }
        });
        insertFragmentAtCaret(fragment, lastNode);
      },
      [insertFragmentAtCaret],
    );

    const insertTokenAtCaret = useCallback(
      (token: ComposerTokenMeta) => {
        const fragment = document.createDocumentFragment();
        const element = createTokenElement(token);
        tokenStoreRef.current.set(token.id, token);
        fragment.append(element);
        insertFragmentAtCaret(fragment, element);
        setTokenCount(tokenStoreRef.current.size);
      },
      [insertFragmentAtCaret],
    );

    const focus = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }
      const range = restoreRange() ?? createRangeAtEnd(editor);
      const selection = window.getSelection();
      if (!selection) {
        editor.focus();
        return;
      }
      selection.removeAllRanges();
      selection.addRange(range);
      savedRangeRef.current = range.cloneRange();
      editor.focus();
    }, [restoreRange]);

    const insertReference = useCallback(
      (
        text: string,
        options?: {
          label?: string;
          trailingText?: string;
        },
      ) => {
        const value = text.replace(/\u00a0/g, ' ').trim();
        if (!value) {
          return;
        }

        const token: ComposerTokenMeta = {
          id: createComposerId('reference'),
          kind: 'reference',
          label: options?.label?.trim() || buildReferenceLabel(value),
          value,
        };
        insertTokenAtCaret(token);
        if (options?.trailingText?.trim()) {
          insertTextAtCaret(` ${options.trailingText.trim()}`);
        }
        focus();
      },
      [focus, insertTextAtCaret, insertTokenAtCaret],
    );

    useImperativeHandle(
      ref,
      () => ({
        focus,
        insertReference,
      }),
      [focus, insertReference],
    );

    const clearComposer = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }
      editor.replaceChildren();
      tokenStoreRef.current.clear();
      savedRangeRef.current = createRangeAtEnd(editor);
      refreshState();
      editor.focus();
    }, [refreshState]);

    const processFiles = useCallback(
      async (files: File[]) => {
        const supportedFiles = files.filter(isSupportedAttachment);
        if (supportedFiles.length === 0) {
          return;
        }

        for (const file of supportedFiles) {
          const token: ComposerTokenMeta = {
            id: createComposerId('attachment'),
            kind: 'attachment',
            label: file.name || '未命名附件',
            value: file.name || '未命名附件',
            mimeType: file.type || 'application/octet-stream',
            dataUrl: isImageAttachment(file.type) ? await readFileAsDataUrl(file) : null,
          };
          insertTokenAtCaret(token);
        }
      },
      [insertTokenAtCaret],
    );

    const handleSubmit = useCallback(async () => {
      if (busy && !hasContent) {
        await onAbort();
        return;
      }

      const editor = editorRef.current;
      if (!editor || !connected) {
        return;
      }

      const payload = serializeEditor(editor, tokenStoreRef.current);
      if (!payload.hasContent) {
        return;
      }
      const accepted = await onSend(payload);
      if (accepted) {
        clearComposer();
      }
    }, [busy, clearComposer, connected, hasContent, onAbort, onSend]);

    useEffect(() => {
      refreshState();
    }, [refreshState]);

    useEffect(() => {
      const handleSelectionChange = () => {
        const editor = editorRef.current;
        const selection = window.getSelection();
        if (!editor || !selection || selection.rangeCount === 0) {
          return;
        }
        const range = selection.getRangeAt(0);
        if (editor.contains(range.startContainer) && editor.contains(range.endContainer)) {
          savedRangeRef.current = range.cloneRange();
        }
      };

      document.addEventListener('selectionchange', handleSelectionChange);
      return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, []);

    const submitLabel = busy && !hasContent ? '停止' : '发送';
    const sendState = busy ? 'busy' : hasContent ? 'ready' : 'empty';

    return (
      <div className="iclaw-composer">
        <div className="iclaw-composer__halo" aria-hidden="true" />
        <div className="iclaw-composer__panel">
          <div className="iclaw-composer__top">
            <div className="iclaw-composer__promo">
              <span className="iclaw-composer__promo-icon">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="iclaw-composer__promo-text">新能力预告位</span>
              <button type="button" className="iclaw-composer__promo-cta">
                试一试
              </button>
            </div>
            <div className="iclaw-composer__top-tools" aria-hidden="true">
              <button type="button" className="iclaw-composer__top-tool">
                <WandSparkles className="h-3.5 w-3.5 iclaw-composer__top-tool-icon iclaw-composer__top-tool-icon--violet" />
                创意增强
              </button>
              <button type="button" className="iclaw-composer__top-tool">
                <Sparkles className="h-3.5 w-3.5 iclaw-composer__top-tool-icon iclaw-composer__top-tool-icon--amber" />
                新功能
              </button>
            </div>
          </div>

          <div className="iclaw-composer__middle">
            <button
              type="button"
              className="iclaw-composer__add"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              disabled={!connected}
              aria-label="添加附件"
              title="添加附件"
            >
              <Plus className="h-4.5 w-4.5" />
            </button>

            <div className="iclaw-composer__input-shell">
              {!hasContent ? (
                <div className="iclaw-composer__placeholder" aria-hidden="true">
                  {connected ? PLACEHOLDER : '网关未连接，暂时无法发送'}
                </div>
              ) : null}
              <div
                ref={editorRef}
                className="iclaw-composer__editor"
                contentEditable={connected}
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label="聊天输入框"
                data-empty="true"
                onInput={() => refreshState()}
                onKeyDown={(event) => {
                  const nativeEvent = event.nativeEvent as KeyboardEvent;
                  if (event.key === 'Enter' && !nativeEvent.isComposing && !event.shiftKey) {
                    event.preventDefault();
                    void handleSubmit();
                    return;
                  }
                  if (event.key === 'Enter' && event.shiftKey) {
                    event.preventDefault();
                    const br = document.createElement('br');
                    const fragment = document.createDocumentFragment();
                    fragment.append(br);
                    insertFragmentAtCaret(fragment, br);
                  }
                }}
                onPaste={(event) => {
                  const clipboardItems = Array.from(event.clipboardData?.items ?? []);
                  const files = clipboardItems
                    .map((item) => item.getAsFile())
                    .filter((file): file is File => Boolean(file) && isSupportedAttachment(file as File));

                  if (files.length > 0) {
                    event.preventDefault();
                    void processFiles(files);
                    return;
                  }

                  const text = event.clipboardData?.getData('text/plain') ?? '';
                  if (text) {
                    event.preventDefault();
                    insertTextAtCaret(text);
                  }
                }}
                onMouseDown={(event) => {
                  const target = event.target as HTMLElement | null;
                  if (!target?.dataset.tokenRemove) {
                    return;
                  }
                  event.preventDefault();
                }}
                onClick={(event) => {
                  const target = event.target as HTMLElement | null;
                  if (!target?.dataset.tokenRemove) {
                    const editor = editorRef.current;
                    if (!editor) {
                      return;
                    }
                    const selection = window.getSelection();
                    if (!selection || selection.rangeCount === 0) {
                      savedRangeRef.current = createRangeAtEnd(editor);
                    }
                    return;
                  }
                  event.preventDefault();
                  const tokenNode = target.closest<HTMLElement>('[data-token-id]');
                  const tokenId = tokenNode?.dataset.tokenId;
                  if (!tokenNode || !tokenId) {
                    return;
                  }
                  tokenNode.remove();
                  tokenStoreRef.current.delete(tokenId);
                  refreshState();
                  editorRef.current?.focus();
                }}
              />
            </div>
          </div>

          <div className="iclaw-composer__footer" aria-hidden="true">
            <div className="iclaw-composer__selectors">
              <button type="button" className="iclaw-composer__selector">
                <Zap className="h-3.5 w-3.5 iclaw-composer__selector-icon iclaw-composer__selector-icon--cyan" />
                Agent
                <ChevronDown className="h-3 w-3" />
              </button>
              <button type="button" className="iclaw-composer__selector">
                <Eye className="h-3.5 w-3.5 iclaw-composer__selector-icon iclaw-composer__selector-icon--blue" />
                视图
              </button>
              <button type="button" className="iclaw-composer__selector">
                <Layers className="h-3.5 w-3.5 iclaw-composer__selector-icon iclaw-composer__selector-icon--green" />
                自动
              </button>
              <button type="button" className="iclaw-composer__selector">
                <Search className="h-3.5 w-3.5 iclaw-composer__selector-icon iclaw-composer__selector-icon--orange" />
                搜索
              </button>
              <span className="iclaw-composer__support">
                <ImageIcon className="h-3.5 w-3.5 iclaw-composer__selector-icon iclaw-composer__selector-icon--rose" />
                图片
              </span>
              <span className="iclaw-composer__support">
                <FileText className="h-3.5 w-3.5 iclaw-composer__selector-icon iclaw-composer__selector-icon--amber" />
                PDF
              </span>
              <span className="iclaw-composer__support">
                <Film className="h-3.5 w-3.5 iclaw-composer__selector-icon iclaw-composer__selector-icon--violet" />
                视频
              </span>
              {tokenCount > 0 ? <span className="iclaw-composer__meta-count">{tokenCount}</span> : null}
            </div>

            <button
              type="button"
              className="iclaw-composer__submit"
              data-state={sendState}
              disabled={!connected || (!busy && !hasContent)}
              onClick={() => void (busy ? onAbort() : handleSubmit())}
              aria-label={submitLabel}
              title={submitLabel}
            >
              {busy ? (
                <Square className="h-[14px] w-[14px]" fill="currentColor" strokeWidth={0} />
              ) : (
                <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*,application/pdf,video/*"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            void processFiles(files);
            event.target.value = '';
          }}
        />
      </div>
    );
  },
);
