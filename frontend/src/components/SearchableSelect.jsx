import React, { useState, useEffect, useRef } from 'react';
import { MdSearch, MdKeyboardArrowDown, MdDelete, MdAdd } from 'react-icons/md';

const SearchableSelect = ({ 
    options = [], // Can be array of strings or array of objects { value, label, id }
    value = '', 
    onChange, 
    placeholder = 'Select option', 
    noResultsText = 'No options found',
    className = '',
    inputClass = '',
    menuClass = '',
    onAddOption, // Callback: async (name) => { ... }
    onDeleteOption, // Callback: async (option) => { ... }
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [showInlineAdd, setShowInlineAdd] = useState(false);
    const [newOptionValue, setNewOptionValue] = useState('');
    
    const containerRef = useRef(null);
    const searchInputRef = useRef(null);
    const inlineInputRef = useRef(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen) {
            if (showInlineAdd && inlineInputRef.current) {
                inlineInputRef.current.focus();
            } else if (searchInputRef.current) {
                searchInputRef.current.focus();
            }
        } else {
            setSearch('');
            setShowInlineAdd(false);
            setNewOptionValue('');
        }
    }, [isOpen, showInlineAdd]);

    const filteredOptions = options.filter(option => {
        const optionVal = typeof option === 'string' ? option : option.label || option.value || '';
        return optionVal.toLowerCase().includes(search.toLowerCase());
    });

    const handleSelect = (option) => {
        const val = typeof option === 'string' ? option : option.value;
        onChange(val);
        setIsOpen(false);
    };

    const getSelectedLabel = () => {
        if (!value) return '';
        const found = options.find(option => {
            if (typeof option === 'string') {
                return option === value;
            }
            return option.value === value;
        });

        if (!found) return value;
        return typeof found === 'string' ? found : found.label;
    };

    const selectedLabel = getSelectedLabel();
    const defaultInputClass = "w-full flex items-center justify-between px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-left text-sm";

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={inputClass || defaultInputClass}
            >
                <span className={`${selectedLabel ? 'text-slate-900' : 'text-slate-400 font-normal'} min-w-0 flex-1 truncate`}>
                    {selectedLabel || placeholder}
                </span>
                <MdKeyboardArrowDown 
                    size={20} 
                    className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} 
                />
            </button>

            {isOpen && (
                <div 
                    style={{ backgroundColor: '#ffffff', opacity: 1, zIndex: 99999 }}
                    className={`absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 animate-scale-in max-h-72 flex flex-col overflow-hidden ${menuClass}`}
                >
                    {!showInlineAdd ? (
                        <>
                            {/* Search Field */}
                            <div className="relative mb-2 flex-shrink-0">
                                <MdSearch className="absolute left-3 top-2.5 text-slate-400" size={18} />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Type to search..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-semibold text-slate-700 text-xs"
                                />
                            </div>

                            {/* Options List */}
                            <div className="overflow-y-auto flex-1 custom-scrollbar space-y-0.5 pr-1">
                                {/* Clear/Empty option */}
                                <button
                                    type="button"
                                    onClick={() => handleSelect('')}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                        !value 
                                            ? 'bg-indigo-50 text-indigo-700' 
                                            : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                                    }`}
                                >
                                    {placeholder}
                                </button>

                                {filteredOptions.length === 0 ? (
                                    <div className="text-center py-4 text-xs font-bold text-slate-400">
                                        {noResultsText}
                                    </div>
                                ) : (
                                    filteredOptions.map((option, idx) => {
                                        const optVal = typeof option === 'string' ? option : option.value;
                                        const optLabel = typeof option === 'string' ? option : option.label;
                                        const isSelected = value === optVal;

                                        return (
                                            <div 
                                                key={idx} 
                                                className={`group/item flex items-center justify-between rounded-xl transition-all ${
                                                    isSelected ? 'bg-indigo-600 text-white font-bold' : 'hover:bg-slate-50'
                                                }`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelect(option)}
                                                    className={`flex-1 text-left px-3 py-2 text-xs font-semibold ${
                                                        isSelected ? 'text-white' : 'text-slate-600 hover:text-slate-800'
                                                    }`}
                                                >
                                                    {optLabel}
                                                </button>
                                                {onDeleteOption && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDeleteOption(option);
                                                        }}
                                                        className={`p-1.5 rounded-lg mr-1 opacity-0 group-hover/item:opacity-100 transition-opacity duration-150 ${
                                                            isSelected 
                                                                ? 'text-indigo-200 hover:text-white hover:bg-indigo-700' 
                                                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                                        }`}
                                                        title="Delete Option"
                                                    >
                                                        <MdDelete size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Add New Option Button */}
                            {onAddOption && (
                                <div className="mt-2 pt-2 border-t border-slate-100 flex-shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setShowInlineAdd(true)}
                                        className="w-full flex items-center justify-center gap-1.5 py-2 hover:bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                                    >
                                        <MdAdd size={16} />
                                        Add New Option
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Inline Add Form */
                        <div className="p-2 space-y-3">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Add Custom Option
                            </div>
                            <input
                                ref={inlineInputRef}
                                type="text"
                                placeholder="Enter custom option name..."
                                value={newOptionValue}
                                onChange={(e) => setNewOptionValue(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-semibold text-slate-700 text-xs"
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                        setShowInlineAdd(false);
                                    }
                                }}
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowInlineAdd(false);
                                        setNewOptionValue('');
                                    }}
                                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (newOptionValue.trim()) {
                                            await onAddOption(newOptionValue.trim());
                                            setNewOptionValue('');
                                            setShowInlineAdd(false);
                                        }
                                    }}
                                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-indigo-600/10"
                                >
                                    Save Option
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
