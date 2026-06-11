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
    const [importProgress, setImportProgress] = useState({ processed: 0, total: 0 });
    const [importStage, setImportStage] = useState('idle');
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
        setImportProgress({ processed: 0, total: 0 });
        setImportStage('uploading');

        try {
            const response = await onImport(file, (event) => {
                const total = event.total || file.size || 0;
                const loaded = Math.min(event.loaded || 0, total || event.loaded || 0);
                if (total > 0 && loaded >= total) {
                    setImportStage('processing');
                }
                setImportProgress({
                    processed: loaded,
                    total
                });
            });

            setImportProgress({
                processed: response.data.total || response.data.success + response.data.failed,
                total: response.data.total || response.data.success + response.data.failed
            });

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
                missingMgr1Codes: errorData.missingMgr1Codes || [],
                missingMgr2Codes: errorData.missingMgr2Codes || []
            });
        } finally {
            setIsImporting(false);
            setImportStage('idle');
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
        setImportProgress({ processed: 0, total: 0 });
        setImportStage('idle');
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

                {/* Progress Bar */}
                {isImporting && (
                    <div className="rounded-2xl p-4 bg-blue-50 border border-blue-100">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-bold text-blue-900">
                                {importStage === 'uploading' ? 'Uploading file...' : 'Processing entries...'}
                            </p>
                            <p className="text-xs font-bold text-blue-600">
                                {importProgress.total > 0
                                    ? Math.round((importProgress.processed / importProgress.total) * 100)
                                    : 'Processing'}%
                            </p>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                            <div 
                                className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-300 ease-out"
                                style={{
                                    width: importProgress.total > 0
                                        ? `${Math.min((importProgress.processed / importProgress.total) * 100, 100)}%`
                                        : importStage === 'processing' ? '100%' : '20%'
                                }}
                            />
                        </div>
                        {importProgress.total > 0 && (
                            <p className="text-xs text-blue-600 mt-2 font-medium">
                                {importStage === 'uploading'
                                    ? `${Math.round(importProgress.processed / 1024)} KB / ${Math.round(importProgress.total / 1024)} KB uploaded`
                                    : `${Math.round(importProgress.processed)} / ${importProgress.total} entries processed`}
                            </p>
                        )}
                    </div>
                )}

                {/* Import Results Display */}
                {result && (
                    <div className="space-y-4">
                        {/* 1. Complete Success */}
                        {result.success && result.failedCount === 0 && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
                                <MdCheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={20} />
                                <div>
                                    <p className="font-bold text-emerald-900 text-sm">Import Successful</p>
                                    <p className="text-xs text-emerald-700 mt-1">{result.message || `Successfully imported ${result.successCount} items.`}</p>
                                </div>
                            </div>
                        )}

                        {/* 2. Partial Success (Warning) */}
                        {result.success && result.failedCount > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                                <MdError className="text-amber-600 shrink-0 mt-0.5" size={20} />
                                <div>
                                    <p className="font-bold text-amber-900 text-sm">Import Completed with Warnings</p>
                                    <p className="text-xs text-amber-700 mt-1">
                                        Imported {result.successCount} items successfully, but {result.failedCount} items failed to import.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 3. Complete Failure */}
                        {!result.success && (
                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
                                <MdError className="text-rose-600 shrink-0 mt-0.5" size={20} />
                                <div>
                                    <p className="font-bold text-rose-900 text-sm">Import Failed</p>
                                    <p className="text-xs text-rose-700 mt-1">{result.message || 'The import process encountered errors and could not be completed.'}</p>
                                </div>
                            </div>
                        )}

                        {/* Row level errors display */}
                        {result.errors && result.errors.length > 0 && (
                            <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50">
                                <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                                    <span className="font-bold text-xs text-slate-700 uppercase tracking-wider">Errors ({result.errors.length})</span>
                                </div>
                                <div className="max-h-48 overflow-y-auto p-4 space-y-2">
                                    {result.errors.map((err, idx) => (
                                        <div key={idx} className="text-xs text-rose-600 font-mono py-1 border-b border-slate-100 last:border-0">
                                            {err}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Missing Codes Download (if any) */}
                        {((result.missingCustomerCodes && result.missingCustomerCodes.length > 0) ||
                          (result.missingProductCodes && result.missingProductCodes.length > 0) ||
                          (result.missingMgr1Codes && result.missingMgr1Codes.length > 0) ||
                          (result.missingMgr2Codes && result.missingMgr2Codes.length > 0)) && (
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                                <p className="font-bold text-slate-800 text-xs uppercase tracking-wider">Missing Master Records</p>
                                <p className="text-xs text-slate-500">
                                    The import contains items or customers that do not exist in the system. Download these files and create them before importing again:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {result.missingCustomerCodes?.length > 0 && (
                                        <button
                                            onClick={() => handleDownloadMissingCodes('missing_customer_codes.txt')}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold hover:bg-slate-50 shadow-sm"
                                        >
                                            <MdDownload size={14} />
                                            Missing Customer Codes ({result.missingCustomerCodes.length})
                                        </button>
                                    )}
                                    {result.missingProductCodes?.length > 0 && (
                                        <button
                                            onClick={() => handleDownloadMissingCodes('missing_product_codes.txt')}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold hover:bg-slate-50 shadow-sm"
                                        >
                                            <MdDownload size={14} />
                                            Missing Product Codes ({result.missingProductCodes.length})
                                        </button>
                                    )}
                                    {result.missingMgr1Codes?.length > 0 && (
                                        <button
                                            onClick={() => handleDownloadMissingCodes('missing_mgr1_codes.txt')}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold hover:bg-slate-50 shadow-sm"
                                        >
                                            <MdDownload size={14} />
                                            Missing MGR 1 Codes ({result.missingMgr1Codes.length})
                                        </button>
                                    )}
                                    {result.missingMgr2Codes?.length > 0 && (
                                        <button
                                            onClick={() => handleDownloadMissingCodes('missing_mgr2_codes.txt')}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold hover:bg-slate-50 shadow-sm"
                                        >
                                            <MdDownload size={14} />
                                            Missing MGR 2 Codes ({result.missingMgr2Codes.length})
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                        onClick={handleClose}
                        disabled={isImporting}
                        className="border border-slate-200 text-slate-500 hover:bg-slate-50 px-8 py-3 rounded-2xl font-black transition-all uppercase text-[10px] tracking-widest active:scale-95 disabled:opacity-50"
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
