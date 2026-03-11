// app/components/Editor.tsx
"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import Image from '@tiptap/extension-image';
import { 
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link as LinkIcon, Unlink, Image as ImageIcon,
  List, ListOrdered, Quote, Code,
  Heading1, Heading2, Heading3, 
  Table as TableIcon, Trash2, SplitSquareHorizontal, SplitSquareVertical,
  Maximize, Minimize
} from 'lucide-react';
import { useState } from 'react';

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  editable?: boolean;
}

const MenuBar = ({ editor, isExpanded, toggleExpand }: { editor: any, isExpanded: boolean, toggleExpand: () => void }) => {
  if (!editor) {
    return null;
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    
    // cancelled
    if (url === null) {
      return;
    }

    // empty
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    // update link
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt('URL of the image:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const MenuButton = ({ onClick, disabled = false, isActive = false, children, title }: any) => (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      title={title}
      className={`p-2 rounded transition-colors ${
        isActive 
          ? 'bg-blue-100 text-blue-700 font-bold' 
          : 'text-slate-600 hover:bg-slate-200'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );

  const Divider = () => <div className="w-px h-6 bg-slate-300 mx-1 self-center hidden sm:block"></div>;

  return (
    <div className="flex flex-col border-b border-slate-200 bg-slate-50 rounded-t-xl overflow-hidden">
      {/* Primary Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 items-center">
        
        {/* Text Styles */}
        <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold">
          <Bold className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic">
          <Italic className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline">
          <UnderlineIcon className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Strikethrough">
          <Strikethrough className="w-4 h-4" />
        </MenuButton>

        <Divider />

        {/* Headings */}
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="Heading 1">
          <Heading1 className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <Heading2 className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <Heading3 className="w-4 h-4" />
        </MenuButton>

        <Divider />

        {/* Alignment */}
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="Align Left">
          <AlignLeft className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="Align Center">
          <AlignCenter className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="Align Right">
          <AlignRight className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })} title="Justify">
          <AlignJustify className="w-4 h-4" />
        </MenuButton>

        <Divider />

        {/* Lists & Quotes */}
        <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List">
          <List className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered List">
          <ListOrdered className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Blockquote">
          <Quote className="w-4 h-4" />
        </MenuButton>

        <Divider />
        
        {/* Inserts & Links */}
        <MenuButton onClick={setLink} isActive={editor.isActive('link')} title="Insert Link">
          <LinkIcon className="w-4 h-4" />
        </MenuButton>
        <MenuButton 
          onClick={() => editor.chain().focus().unsetLink().run()} 
          disabled={!editor.isActive('link')}
          title="Remove Link"
        >
          <Unlink className="w-4 h-4" />
        </MenuButton>
        <MenuButton onClick={addImage} title="Insert Image">
          <ImageIcon className="w-4 h-4" />
        </MenuButton>

        <Divider />

        {/* Tables */}
        <MenuButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert Table">
          <span className="flex items-center gap-1"><TableIcon className="w-4 h-4" /> <span className="font-semibold text-xs hidden sm:inline">Table</span></span>
        </MenuButton>

        <div className="flex-1"></div>

        {/* Expand Toggle */}
        <MenuButton onClick={toggleExpand} title={isExpanded ? "Collapse Editor" : "Expand Editor"}>
          {isExpanded ? <Minimize className="w-4 h-4 text-emerald-600" /> : <Maximize className="w-4 h-4 text-slate-500" />}
        </MenuButton>

      </div>

      {/* Secondary Toolbar (Table Controls - Only visible when inside a table) */}
      {editor.isActive('table') && (
        <div className="flex flex-wrap gap-1 p-2 bg-slate-100/80 border-t border-slate-200 shadow-inner">
          <MenuButton onClick={() => editor.chain().focus().addColumnBefore().run()} title="Add Column Before">
            <SplitSquareVertical className="w-4 h-4" />
          </MenuButton>
          <MenuButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add Column After">
            <SplitSquareVertical className="w-4 h-4 transform rotate-180" />
          </MenuButton>
          <MenuButton onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete Column">
            <span className="flex items-center gap-1 text-xs text-red-600"><Trash2 className="w-3 h-3"/> Col</span>
          </MenuButton>
          
          <Divider />
          
          <MenuButton onClick={() => editor.chain().focus().addRowBefore().run()} title="Add Row Before">
            <SplitSquareHorizontal className="w-4 h-4" />
          </MenuButton>
          <MenuButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add Row After">
            <SplitSquareHorizontal className="w-4 h-4 transform rotate-180" />
          </MenuButton>
          <MenuButton onClick={() => editor.chain().focus().deleteRow().run()} title="Delete Row">
             <span className="flex items-center gap-1 text-xs text-red-600"><Trash2 className="w-3 h-3"/> Row</span>
          </MenuButton>

          <Divider />

          <MenuButton onClick={() => editor.chain().focus().deleteTable().run()} title="Delete Table">
            <span className="flex items-center gap-1 text-xs font-semibold text-red-600"><Trash2 className="w-4 h-4"/> Delete Table</span>
          </MenuButton>
        </div>
      )}
    </div>
  );
};

export default function Editor({ content, onChange, editable = true }: EditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline hover:text-blue-800 cursor-pointer',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-xl max-w-full h-auto',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse table-auto w-full my-4 border border-slate-300 rounded-sm overflow-hidden',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'border-b border-slate-300 bg-white last:border-b-0',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border-l border-r border-slate-300 bg-slate-100 font-bold p-2 text-left text-slate-900',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-slate-300 p-2 min-w-[3em]',
        },
      }),
    ],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm xl:prose-base max-w-none focus:outline-none min-h-[400px] p-6 text-slate-800 prose-headings:font-bold prose-a:text-blue-600 prose-img:rounded-xl',
      },
    },
  });

  return (
    <div className={`border border-slate-200 bg-white flex flex-col transition-all duration-200 ${
      isExpanded 
        ? 'fixed inset-4 z-[100] rounded-xl shadow-[0_0_0_100vw_rgba(0,0,0,0.5)]' 
        : 'rounded-xl h-full flex-grow shadow-sm'
    }`}>
      {editable && <MenuBar editor={editor} isExpanded={isExpanded} toggleExpand={() => setIsExpanded(!isExpanded)} />}
      <div 
        className="flex-1 overflow-y-auto w-full h-full p-2 bg-white cursor-text tiptap-container pb-6" 
        onClick={() => {
          if (editable) {
            editor?.commands.focus();
          }
        }}
      >
        <style dangerouslySetInnerHTML={{__html: `
          .tiptap-container .ProseMirror td, .tiptap-container .ProseMirror th {
             border: 1px solid #cbd5e1;
             padding: 0.5rem;
             min-width: 3em;
          }
          .tiptap-container .ProseMirror table {
             border-collapse: collapse;
             width: 100%;
             margin: 1rem 0;
          }
          .tiptap-container .ProseMirror th {
             background-color: #f1f5f9;
          }
          .tiptap-container .ProseMirror .selectedCell:after {
             z-index: 2;
             position: absolute;
             content: "";
             left: 0; right: 0; top: 0; bottom: 0;
             background: rgba(200, 200, 255, 0.4);
             pointer-events: none;
          }
          .tiptap-container .ProseMirror .column-resize-handle {
              position: absolute;
              right: -2px;
              top: 0;
              bottom: -2px;
              width: 4px;
              background-color: #3b82f6;
              pointer-events: none;
          }
        `}} />
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
