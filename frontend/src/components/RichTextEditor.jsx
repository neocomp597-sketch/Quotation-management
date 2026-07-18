import React, { useRef, useEffect } from 'react';
import { 
    MdFormatBold, 
    MdFormatItalic, 
    MdFormatUnderlined, 
    MdFormatListBulleted, 
    MdFormatListNumbered, 
    MdTitle,
    MdInsertLink,
    MdFormatClear 
} from 'react-icons/md';

const RichTextEditor = ({ value, onChange, placeholder }) => {
    const editorRef = useRef(null);

    // Sync external value with editor content (only if changed externally)
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value || '';
        }
    }, [value]);

    const execCmd = (command, arg = '') => {
        document.execCommand(command, false, arg);
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const addLink = () => {
        const url = prompt("Enter URL:");
        if (url) {
            execCmd('createLink', url);
        }
    };

    return (
        <div className="border border-slate-200 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500 transition-all bg-white">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 border-b border-slate-200 select-none">
                <button
                    type="button"
                    onClick={() => execCmd('bold')}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors"
                    title="Bold"
                >
                    <MdFormatBold size={20} />
                </button>
                <button
                    type="button"
                    onClick={() => execCmd('italic')}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors"
                    title="Italic"
                >
                    <MdFormatItalic size={20} />
                </button>
                <button
                    type="button"
                    onClick={() => execCmd('underline')}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors"
                    title="Underline"
                >
                    <MdFormatUnderlined size={20} />
                </button>
                <div className="w-px h-5 bg-slate-200 mx-1"></div>
                <button
                    type="button"
                    onClick={() => execCmd('formatBlock', '<h1>')}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors flex items-center gap-0.5"
                    title="Heading 1"
                >
                    <MdTitle size={20} /><span className="text-[10px] font-black">1</span>
                </button>
                <button
                    type="button"
                    onClick={() => execCmd('formatBlock', '<h2>')}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors flex items-center gap-0.5"
                    title="Heading 2"
                >
                    <MdTitle size={20} /><span className="text-[10px] font-black">2</span>
                </button>
                <button
                    type="button"
                    onClick={() => execCmd('formatBlock', '<p>')}
                    className="px-2 py-1 rounded-lg text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors text-xs font-black"
                    title="Paragraph"
                >
                    P
                </button>
                <div className="w-px h-5 bg-slate-200 mx-1"></div>
                <button
                    type="button"
                    onClick={() => execCmd('insertUnorderedList')}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors"
                    title="Bullet List"
                >
                    <MdFormatListBulleted size={20} />
                </button>
                <button
                    type="button"
                    onClick={() => execCmd('insertOrderedList')}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors"
                    title="Numbered List"
                >
                    <MdFormatListNumbered size={20} />
                </button>
                <div className="w-px h-5 bg-slate-200 mx-1"></div>
                <button
                    type="button"
                    onClick={addLink}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors"
                    title="Insert Link"
                >
                    <MdInsertLink size={20} />
                </button>
                <button
                    type="button"
                    onClick={() => execCmd('removeFormat')}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors"
                    title="Clear Formatting"
                >
                    <MdFormatClear size={20} />
                </button>
            </div>

            {/* Editable Area */}
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                className="min-h-[250px] max-h-[450px] overflow-y-auto p-4 outline-none rich-text-container"
                style={{ minHeight: '250px' }}
                placeholder={placeholder}
            />
        </div>
    );
};

export default RichTextEditor;
