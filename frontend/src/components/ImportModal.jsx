import React, { useState, useRef } from 'react';
import { MdCloudUpload, MdDownload, MdDescription, MdClose, MdCheckCircle, MdError } from 'react-icons/md';
import Modal from './Modal';
import api from '../services/api';

const ImportModal = ({ isOpen, onClose, title, onImport, onDownloadTemplate, type = 'products' }) => {
    const [file, setFile] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [result, setResult] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    const handleFileSelect = (selectedFile) => {
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv',
            'application/csv'
        ];
        const validExtensions = ['.xlsx', '.xls', '.csv'];

        const isValidType = validTypes.includes(selectedFile.type) ||
            validExtensions.some(ext => selectedFile.name.toLowerCase().endsWith(ext));

        if (!isValidType) {
            alert('Please upload an Excel (.xlsx, .xls) or CSV file');
            return;
        }
        setFile(selectedFile);
        setResult(null);
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
        }
    };

    const handleImport = async () => {
        if (!file) return;

        setIsImporting(true);
        setResult(null);

        try {
            const response = await onImport(file);
            setResult({
                success: true,
                message: response.data.message,
                successCount: response.data.success,
                failedCount: response.data.failed,
                errors: response.data.errors || []
            });
            setFile(null);
        } catch (err) {
            const errorData = err.response?.data || {};
            setResult({
                success: false,
                message: errorData.message || 'Import failed',
                errors: errorData.errors || [],
                missingCustomerCodes: errorData.missingCustomerCodes || [],
                missingProductCodes: errorData.missingProductCodes || [],
                missingCustomerCodesFile: errorData.missingCustomerCodesFile || null,
                missingProductCodesFile: errorData.missingProductCodesFile || null
            });
        } finally {
            setIsImporting(false);
        }
    };

    const handleDownloadMissingCodes = async (filename) => {
        try {
            const response = await api.get(`/import/missing-codes/${filename}`, {
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download error:', err);
            alert('Failed to download file');
        }
    };

    const handleDownloadTemplate = async () => {
        setIsDownloading(true);
        try {
            const response = await onDownloadTemplate();
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${type}_import_template.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Template download error:', err);
            alert('Failed to download template');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleClose = () => {
        setFile(null);
        setResult(null);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={title}
            maxWidth="max-w-xl"
        >
            <div className="space-y-6">
                {/* Download Template Section */}
                <div className="bg-gradient-to-br from-primary-50 to-primary-100/50 rounded-2xl p-5 border border-primary-100">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-white rounded-xl shadow-sm">
                            <MdDescription className="text-primary-600" size={24} />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-slate-900 mb-1">Download Template</h4>
                            <p className="text-sm text-slate-500 mb-3">
                                Download the Excel template with the correct format and sample data.
                            </p>
                            <button
                                onClick={handleDownloadTemplate}
                                disabled={isDownloading}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-primary-200 rounded-xl text-primary-600 font-bold text-xs uppercase tracking-widest hover:bg-primary-50 transition-all disabled:opacity-50"
                            >
                                <MdDownload size={16} />
                                {isDownloading ? 'Downloading...' : 'Download Template'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Upload Section */}
                <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-2xl p-4 md:p-8 text-center cursor-pointer transition-all ${dragActive
                        ? 'border-primary-500 bg-primary-50'
                        : file
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-slate-200 bg-slate-50 hover:border-primary-300 hover:bg-primary-50/30'
                        }`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileChange}
                        className="hidden"
                    />

                    {file ? (
                        <div className="flex flex-col items-center">
                            <div className="p-4 bg-emerald-100 rounded-full mb-4">
                                <MdCheckCircle className="text-emerald-600" size={32} />
                            </div>
                            <p className="font-bold text-slate-900 mb-1">{file.name}</p>
                            <p className="text-sm text-slate-500">
                                {(file.size / 1024).toFixed(1)} KB
                            </p>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setFile(null);
                                    setResult(null);
                                }}
                                className="mt-3 text-xs text-rose-500 hover:text-rose-700 font-bold uppercase tracking-widest"
                            >
                                Remove File
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <div className={`p-4 rounded-full mb-4 ${dragActive ? 'bg-primary-100' : 'bg-slate-100'}`}>
                                <MdCloudUpload className={dragActive ? 'text-primary-600' : 'text-slate-400'} size={32} />
                            </div>
                            <p className="font-bold text-slate-900 mb-1">
                                {dragActive ? 'Drop your file here' : 'Drag & drop your file here'}
                            </p>
                            <p className="text-sm text-slate-500">
                                or click to browse
                            </p>
                            <p className="text-xs text-slate-400 mt-2">
                                Supports: .xlsx, .xls, .csv (max 10MB)
                            </p>
                        </div>
                    )}
                </div>

                {/* Result Section */}
                {result && (
                    <div className={`rounded-2xl p-4 ${result.success ? 'bg-emerald-50 border border-emerald-100' : 'bg-rose-50 border border-rose-100'}`}>
                        <div className="flex items-start gap-3">
                            {result.success ? (
                                <MdCheckCircle className="text-emerald-600 flex-shrink-0 mt-0.5" size={20} />
                            ) : (
                                <MdError className="text-rose-600 flex-shrink-0 mt-0.5" size={20} />
                            )}
                            <div className="flex-1">
                                <p className={`font-bold ${result.success ? 'text-emerald-800' : 'text-rose-800'}`}>
                                    {result.message}
                                </p>
                                {result.success && (
                                    <p className="text-sm text-emerald-600 mt-1">
                                        {result.successCount} imported successfully, {result.failedCount} failed
                                    </p>
                                )}
                                {(result.missingCustomerCodes && result.missingCustomerCodes.length > 0) && (
                                    <div className="mt-3">
                                        <p className="text-xs text-rose-600 font-bold uppercase tracking-widest mb-1">
                                            Missing Customer Codes ({result.missingCustomerCodes.length}):
                                        </p>
                                        <div className="max-h-24 overflow-y-auto bg-white rounded-lg p-2 border border-rose-200">
                                            <p className="text-xs font-mono text-rose-700">{result.missingCustomerCodes.slice(0, 10).join(', ')}</p>
                                            {result.missingCustomerCodes.length > 10 && (
                                                <p className="text-xs text-rose-500">...and {result.missingCustomerCodes.length - 10} more</p>
                                            )}
                                        </div>
                                        {result.missingCustomerCodesFile && (
                                            <button
                                                onClick={() => handleDownloadMissingCodes(result.missingCustomerCodesFile)}
                                                className="mt-2 flex items-center gap-1 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 rounded-lg text-rose-700 text-xs font-bold transition-all"
                                            >
                                                <MdDescription size={14} />
                                                Download List
                                            </button>
                                        )}
                                    </div>
                                )}
                                {(result.missingProductCodes && result.missingProductCodes.length > 0) && (
                                    <div className="mt-3">
                                        <p className="text-xs text-rose-600 font-bold uppercase tracking-widest mb-1">
                                            Missing Product Codes ({result.missingProductCodes.length}):
                                        </p>
                                        <div className="max-h-24 overflow-y-auto bg-white rounded-lg p-2 border border-rose-200">
                                            <p className="text-xs font-mono text-rose-700">{result.missingProductCodes.slice(0, 10).join(', ')}</p>
                                            {result.missingProductCodes.length > 10 && (
                                                <p className="text-xs text-rose-500">...and {result.missingProductCodes.length - 10} more</p>
                                            )}
                                        </div>
                                        {result.missingProductCodesFile && (
                                            <button
                                                onClick={() => handleDownloadMissingCodes(result.missingProductCodesFile)}
                                                className="mt-2 flex items-center gap-1 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 rounded-lg text-rose-700 text-xs font-bold transition-all"
                                            >
                                                <MdDescription size={14} />
                                                Download List
                                            </button>
                                        )}
                                    </div>
                                )}
                                {result.errors && result.errors.length > 0 && (
                                    <div className="mt-3 max-h-32 overflow-y-auto">
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Errors:</p>
                                        {result.errors.map((err, idx) => (
                                            <p key={idx} className="text-xs text-rose-600">{err}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                        onClick={handleClose}
                        className="px-6 py-2.5 text-slate-500 font-black hover:text-slate-900 transition-all uppercase text-[10px] tracking-widest"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={!file || isImporting}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-xl shadow-primary-600/20 uppercase text-[10px] tracking-widest active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <MdCloudUpload size={16} />
                        {isImporting ? 'Importing...' : 'Import Data'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ImportModal;
