import { ReactRenderer } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import CommandsList, { type CommandsListHandle, type SlashItem } from "./commands-list";
import { Code, Heading1, Heading2, Heading3, Image, List, ListOrdered, Pilcrow, Quote, Table } from "lucide-react";
import type { SuggestionOptions as TiptapSuggestionOptions } from "@tiptap/suggestion";

export type ImagePickerUrlResult = {
  kind: "url";
  src: string;
  alt?: string;
  title?: string;
};

export type ImagePickerFileResult = {
  kind: "file";
  file: File;
  alt?: string;
  title?: string;
};

export type ImagePickerResult = ImagePickerUrlResult | ImagePickerFileResult;

export type ImagePickerContext = {
  editor: Editor;
  range: { from: number; to: number };
};

export type ImagePickerHandler = (
  context: ImagePickerContext,
) => ImagePickerResult | null | Promise<ImagePickerResult | null>;

export type SlashImageFallback = "prompt-url" | "none";

type SuggestionOptions = {
  onRequestImage?: ImagePickerHandler | null;
  onInsertLocalImageFile?: ((context: ImagePickerContext & Omit<ImagePickerFileResult, "kind">) => void | Promise<void>) | null;
  enableImages?: boolean;
  imageSlashFallback?: SlashImageFallback;
};

const TABLE_SAFE_COMMAND_IDS = new Set(["image"]);

type RequestImageAndInsertArgs = ImagePickerContext & {
  onRequestImage: ImagePickerHandler | null;
  onInsertLocalImageFile: ((context: ImagePickerContext & Omit<ImagePickerFileResult, "kind">) => void | Promise<void>) | null;
  imageSlashFallback: SlashImageFallback;
};

const getPopupAppendTarget = (editor: Editor): HTMLElement => {
  return (
    editor.view.dom.closest<HTMLElement>("[data-task-detail-floating-layer-root]") ??
    editor.view.dom.closest<HTMLElement>("[data-editor-suggestion-root]") ??
    document.body
  );
};

const requestImageAndInsert = async ({
  editor,
  range,
  onRequestImage,
  onInsertLocalImageFile,
  imageSlashFallback = "prompt-url",
}: RequestImageAndInsertArgs): Promise<void> => {
  let result: ImagePickerResult | null = null;
  if (onRequestImage) {
    result = await onRequestImage({ editor, range });
  } else if (imageSlashFallback === "prompt-url") {
    const src = window.prompt("图片地址")?.trim();
    result = src ? { kind: "url", src } : null;
  }

  if (!result) return;

  if (result.kind === "file") {
    if (!onInsertLocalImageFile) return;
    editor.chain().focus().deleteRange(range).run();
    const fileInsertContext: ImagePickerContext & Omit<ImagePickerFileResult, "kind"> = {
      editor,
      range,
      file: result.file,
      ...(result.alt ? { alt: result.alt } : {}),
      ...(result.title ? { title: result.title } : {}),
    };
    await onInsertLocalImageFile(fileInsertContext);
    return;
  }

  const imageAttrs = {
    src: result.src,
    ...(result.alt ? { alt: result.alt } : {}),
    ...(result.title ? { title: result.title } : {}),
  };

  editor
    .chain()
    .focus()
    .deleteRange(range)
    .setImage(imageAttrs)
    .run();
};

const getAllItems = (options: SuggestionOptions): SlashItem[] => [
  {
    id: "paragraph",
    title: "正文",
    aliases: ["text", "paragraph"],
    icon: Pilcrow,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    id: "heading1",
    title: "一级标题",
    aliases: ["h1", "heading 1"],
    icon: Heading1,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
  },
  {
    id: "heading2",
    title: "二级标题",
    aliases: ["h2", "heading 2"],
    icon: Heading2,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
  },
  {
    id: "heading3",
    title: "三级标题",
    aliases: ["h3", "heading 3"],
    icon: Heading3,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
  },
  {
    id: "bulletList",
    title: "无序列表",
    aliases: ["bullet", "ul", "list"],
    icon: List,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    id: "orderedList",
    title: "有序列表",
    aliases: ["number", "ol", "list"],
    icon: ListOrdered,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    id: "image",
    title: "图片",
    aliases: ["image", "img"],
    icon: Image,
    command: ({ editor, range }) => {
      void requestImageAndInsert({
        editor,
        range,
        onRequestImage: options.onRequestImage ?? null,
        onInsertLocalImageFile: options.onInsertLocalImageFile ?? null,
        imageSlashFallback: options.imageSlashFallback ?? "prompt-url",
      });
    },
  },
  {
    id: "table",
    title: "表格",
    aliases: ["table"],
    icon: Table,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: "blockquote",
    title: "引用",
    aliases: ["quote", "blockquote"],
    icon: Quote,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    id: "codeBlock",
    title: "代码块",
    aliases: ["code", "pre"],
    icon: Code,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
];

const matchesQuery = (item: SlashItem, query: string): boolean => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return [item.title, ...(item.aliases ?? [])].some((keyword) =>
    keyword.toLowerCase().includes(normalizedQuery),
  );
};

type SlashSuggestion = Pick<TiptapSuggestionOptions, "items" | "render">;
type SuggestionRenderLifecycle = NonNullable<ReturnType<NonNullable<SlashSuggestion["render"]>>>;
type SuggestionKeyDownProps = Parameters<NonNullable<SuggestionRenderLifecycle["onKeyDown"]>>[0];

const createSuggestion = (options: SuggestionOptions = {}): SlashSuggestion => ({
  items: ({ query, editor }: { query: string; editor: Editor }) => {
    const isInTableCell = editor.isActive("tableCell") || editor.isActive("tableHeader");
    return getAllItems(options)
      .filter((item) => !isInTableCell || TABLE_SAFE_COMMAND_IDS.has(item.id))
      .filter((item) => options.enableImages !== false || item.id !== "image")
      .filter((item) => matchesQuery(item, query))
      .slice(0, 10);
  },

  render: (): SuggestionRenderLifecycle => {
    let component: ReactRenderer<CommandsListHandle> | null = null;
    let popup: TippyInstance | null = null;

    return {
      onStart: (props) => {
        component = new ReactRenderer(CommandsList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) return;
        const referenceRect = () => props.clientRect?.() ?? new DOMRect(0, 0, 0, 0);

        popup = tippy(document.body, {
          getReferenceClientRect: referenceRect,
          appendTo: () => getPopupAppendTarget(props.editor),
          content: component.element,
          showOnCreate: true,
          zIndex: 1400,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
          popperOptions: {
            strategy: "fixed",
          },
        });
      },

      onUpdate: (props) => {
        if (!component) return;
        component.updateProps(props);
        if (!props.clientRect || !popup) return;
        const referenceRect = () => props.clientRect?.() ?? new DOMRect(0, 0, 0, 0);
        popup.setProps({ getReferenceClientRect: referenceRect });
      },

      onKeyDown: ({ event }: SuggestionKeyDownProps): boolean => {
        if (event.key === "Escape" && popup) {
          popup.hide();
          return true;
        }

        return component?.ref?.onKeyDown(event) ?? false;
      },

      onExit: (): void => {
        if (popup) popup.destroy();
        component?.destroy();
      },
    };
  },
});

export default createSuggestion;
