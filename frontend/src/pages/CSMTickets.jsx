import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { csmService, customerService, productService, voucherService, userService, importService, uploadService } from '../services/api';
import { toast } from 'react-toastify';
import { MdAdd, MdSearch, MdFilterList, MdArrowForward, MdEdit, MdDelete, MdPublish, MdFileDownload, MdWarning, MdInfoOutline, MdPhotoCamera, MdCloudUpload } from 'react-icons/md';
import * as XLSX from 'xlsx';
import PaginationControls from '../components/PaginationControls';
import PortalDropdown from '../components/PortalDropdown';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import { useSubmitGuard } from '../hooks/useSubmitGuard';

const statusStyles = {
    'Open': 'bg-emerald-50 text-emerald-600 border-emerald-200',
    'Assigned': 'bg-blue-50 text-blue-600 border-blue-200',
    'In Progress': 'bg-indigo-50 text-indigo-600 border-indigo-200',
    'Pending Customer': 'bg-amber-50 text-amber-600 border-amber-200',
    'Resolved': 'bg-teal-50 text-teal-600 border-teal-200',
    'Closed': 'bg-slate-50 text-slate-500 border-slate-200',
    'Escalated': 'bg-rose-50 text-rose-600 border-rose-200',
    'Cancelled': 'bg-rose-50/50 text-rose-400 border-rose-100'
};

const getManualImagesForTicket = (ticket) => {
    const images = {
        front: null,
        back: null,
        left: null,
        right: null,
        invoice: null,
        other: []
    };
    
    const desc = ticket.description || '';
    const frontMatch = desc.match(/• FRONT:\s*(https?:\/\/\S+)/i);
    const backMatch = desc.match(/• BACK:\s*(https?:\/\/\S+)/i);
    const leftMatch = desc.match(/• LEFT:\s*(https?:\/\/\S+)/i);
    const rightMatch = desc.match(/• RIGHT:\s*(https?:\/\/\S+)/i);
    const invoiceMatch = desc.match(/• INVOICE:\s*(https?:\/\/\S+)/i);
    
    if (frontMatch) images.front = frontMatch[1];
    if (backMatch) images.back = backMatch[1];
    if (leftMatch) images.left = leftMatch[1];
    if (rightMatch) images.right = rightMatch[1];
    if (invoiceMatch) images.invoice = invoiceMatch[1];
    
    if (ticket.comments && ticket.comments.length > 0) {
        ticket.comments.forEach(c => {
            if (c.attachments && c.attachments.length > 0) {
                c.attachments.forEach(url => {
                    const allUrls = [images.front, images.back, images.left, images.right, images.invoice].filter(Boolean);
                    if (!allUrls.includes(url)) {
                        images.other.push(url);
                    }
                });
            }
        });
    }
    
    return images;
};

const CSMTickets = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [tickets, setTickets] = useState([]);
    
    // Pagination & Filter States
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [filterInvoiceType, setFilterInvoiceType] = useState('');
    const [filterCustomer, setFilterCustomer] = useState('');
    const [ticketCustomers, setTicketCustomers] = useState([]);

    // Masters lists for creation
    const [customers, setCustomers] = useState([]);
    const [priorities, setPriorities] = useState([]);
    const [categories, setCategories] = useState([]);
    const [types, setTypes] = useState([]);
    const [products, setProducts] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [sources, setSources] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [customerContacts, setCustomerContacts] = useState([]);
    const [assets, setAssets] = useState([]);
    const [assetSummary, setAssetSummary] = useState(null);
    const [showAllProducts, setShowAllProducts] = useState(false);
    const [generatedSerial, setGeneratedSerial] = useState('');
    
    // Import tracking states
    const [importResult, setImportResult] = useState(null);
    const [showImportResultModal, setShowImportResultModal] = useState(false);

    // Page View State: 'list' | 'standard' | 'manual'
    const [pageView, setPageView] = useState('list');

    // Modal & Form State
    const [showModal, setShowModal] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [isManualCustomerText, setIsManualCustomerText] = useState(false);
    const [isManualProductText, setIsManualProductText] = useState(false);
    const [manualFormData, setManualFormData] = useState({
        customerId: '',
        customerName: '',
        invoiceNo: '',
        invoiceDate: '',
        serialNumber: '',
        productId: '',
        customProductName: '',
        source: 'Phone',
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        pincode: '',
        priority: 'Medium',
        category: 'Repair',
        type: 'Service',
        issueTitle: '',
        description: ''
    });
    const [manualImages, setManualImages] = useState({
        front: null,
        back: null,
        left: null,
        right: null,
        invoice: null
    });
    const [uploadingImage, setUploadingImage] = useState({
        front: false,
        back: false,
        left: false,
        right: false,
        invoice: false
    });
    const [selectedManualTicket, setSelectedManualTicket] = useState(null);
    const [showManualViewModal, setShowManualViewModal] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [contactFormData, setContactFormData] = useState({
        contactName: '',
        designationId: '',
        mobileNo: '',
        email: '',
        isPrimary: false
    });

    // Mini Master Modal State
    const [activeMiniMaster, setActiveMiniMaster] = useState(null);
    const [miniMasterFormData, setMiniMasterFormData] = useState({
        name: '',
        description: '',
        responseSlaHours: '1',
        resolutionSlaHours: '4',
        color: '#3b82f6'
    });
    const [miniMasterSearch, setMiniMasterSearch] = useState('');
    const [editingItemId, setEditingItemId] = useState(null);
    const [editingItemFormData, setEditingItemFormData] = useState({
        name: '',
        description: '',
        responseSlaHours: '1',
        resolutionSlaHours: '4',
        color: '#3b82f6'
    });
    const [formData, setFormData] = useState({
        customerId: '',
        contactId: '',
        contactName: '',
        contactDesignationId: '',
        contactDesignation: '',
        contactPhone: '',
        contactEmail: '',
        pincode: '',
        priorityId: '',
        categoryId: '',
        typeId: '',
        productId: '',
        assetId: '',
        invoiceId: '',
        issueTitle: '',
        description: '',
        source: 'Web Portal',
        serialNumber: ''
    });

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const queryParams = {
                page,
                limit: 10,
                search,
                status: filterStatus,
                priorityId: filterPriority
            };
            if (filterCustomer) {
                queryParams.customerId = filterCustomer;
            }
            if (filterInvoiceType === 'manual') {
                queryParams.isManual = 'true';
            } else if (filterInvoiceType === 'standard') {
                queryParams.isManual = 'false';
            }
            const res = await csmService.getTickets(queryParams);
            setTickets(res.data?.data || []);
            setTotalPages(res.data?.pagination?.pages || 1);
        } catch (error) {
            toast.error('Failed to load tickets');
        } finally {
            setLoading(false);
        }
    };

    const fetchTicketCustomers = async () => {
        try {
            const res = await csmService.getTicketCustomers();
            setTicketCustomers(res.data || []);
        } catch (error) {
            console.error('Failed to load ticket customers:', error);
        }
    };

    const loadCreationData = async () => {
        try {
            const [custRes, priRes, catRes, typRes, prodRes, srcRes, desRes, assetRes] = await Promise.allSettled([
                customerService.getAll({ limit: 500 }),
                csmService.getPriorities(),
                csmService.getCategories(),
                csmService.getTypes(),
                productService.getAll({ limit: 500 }),
                csmService.getSources(),
                csmService.getDesignations(),
                csmService.getAssets()
            ]);

            const valueOf = (result) => result.status === 'fulfilled' ? result.value : null;
            const customersRes = valueOf(custRes);
            const prioritiesRes = valueOf(priRes);
            const categoriesRes = valueOf(catRes);
            const typesRes = valueOf(typRes);
            const productsRes = valueOf(prodRes);
            const sourcesRes = valueOf(srcRes);
            const designationsRes = valueOf(desRes);
            const assetsRes = valueOf(assetRes);

            setCustomers(customersRes?.data?.data || customersRes?.data || []);
            
            const prioritiesData = prioritiesRes?.data || [];
            setPriorities(prioritiesData);
            const lowPriority = prioritiesData.find(p => p.name?.toLowerCase() === 'low');
            if (lowPriority && !formData.priorityId) {
                setFormData(prev => ({ ...prev, priorityId: lowPriority._id }));
            }

            setCategories(categoriesRes?.data || []);
            setTypes(typesRes?.data || []);
            setProducts(productsRes?.data?.data || productsRes?.data || []);
            setSources(sourcesRes?.data || []);
            setDesignations(designationsRes?.data || []);
            setAssets(assetsRes?.data || []);

            const failed = [custRes, priRes, catRes, typRes, prodRes, srcRes, desRes, assetRes].some(result => result.status === 'rejected');
            if (failed) {
                console.error('One or more ticket form dropdowns failed to load', {
                    customers: custRes.status,
                    priorities: priRes.status,
                    categories: catRes.status,
                    types: typRes.status,
                    products: prodRes.status,
                    sources: srcRes.status,
                    designations: desRes.status,
                    assets: assetRes.status
                });
            }
        } catch (error) {
            console.error('Error preloading ticket forms:', error);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, [page, filterStatus, filterPriority, filterInvoiceType, filterCustomer]);

    useEffect(() => {
        fetchTicketCustomers();
    }, []);

    useEffect(() => {
        if (showModal || showManualModal) {
            loadCreationData();
        }
    }, [showModal, showManualModal]);

    // Fetch customer invoices when customer is selected in creation form
    useEffect(() => {
        if (formData.customerId) {
            voucherService.getAll({ customerId: formData.customerId, voucherType: 'Invoice' })
                .then(res => setInvoices(res.data?.data || res.data || []))
                .catch(err => console.error('Error fetching customer invoices:', err));
            csmService.getCustomerContacts({ customerId: formData.customerId })
                .then(res => setCustomerContacts(res.data || []))
                .catch(err => {
                    console.error('Error fetching customer contacts:', err);
                    setCustomerContacts([]);
                });
        } else {
            setInvoices([]);
            setCustomerContacts([]);
        }
    }, [formData.customerId]);

    // Fetch assets dynamically when customer or product changes to auto-select serial number
    useEffect(() => {
        if (formData.customerId && formData.productId) {
            csmService.getAssets({ customerId: formData.customerId, productId: formData.productId })
                .then(res => {
                    const fetchedAssets = res.data || [];
                    setAssets(prev => {
                        const existingIds = new Set(prev.map(a => a._id));
                        const newAssets = fetchedAssets.filter(a => !existingIds.has(a._id));
                        return [...prev, ...newAssets];
                    });
                    
                    if (fetchedAssets.length > 0) {
                        const firstAsset = fetchedAssets[0];
                        setFormData(prev => {
                            if (!prev.assetId) {
                                return { ...prev, assetId: firstAsset._id, serialNumber: firstAsset.serialNumber || '' };
                            }
                            return prev;
                        });
                        setGeneratedSerial('');
                        
                        csmService.getAssetSummary({ assetId: firstAsset._id })
                            .then(summaryRes => {
                                setAssetSummary(summaryRes.data);
                                const hasCoverage = summaryRes.data.warranty?.status === 'Active' || summaryRes.data.amc?.status === 'Active';
                                if (!hasCoverage) {
                                    const medPriority = priorities.find(p => p.name?.toLowerCase() === 'medium');
                                    if (medPriority) {
                                        setFormData(prev => ({ ...prev, priorityId: medPriority._id }));
                                    }
                                }
                            })
                            .catch(err => console.error('Error fetching asset summary:', err));
                    } else {
                        // Generate a serial number if no assets exist
                        setFormData(prev => {
                            if (!prev.assetId && !generatedSerial) {
                                const selectedProd = products.find(p => p._id === formData.productId);
                                const prodCode = selectedProd?.productCode || 'PROD';
                                const randomNum = Math.floor(1000 + Math.random() * 9000);
                                const tempSN = `SN-${prodCode.replace(/\s+/g, '')}-${randomNum}`;
                                setGeneratedSerial(tempSN);
                                return { ...prev, serialNumber: tempSN };
                            }
                            return prev;
                        });
                    }
                })
                .catch(err => console.error('Error fetching assets dynamically:', err));
        }
    }, [formData.customerId, formData.productId, priorities, products, generatedSerial]);

    const handleCustomerChange = (customerId) => {
        const selectedCust = customers.find(c => c._id === customerId);
        setFormData(prev => ({
            ...prev,
            customerId,
            contactId: '',
            contactName: '',
            contactDesignationId: '',
            contactDesignation: '',
            contactPhone: selectedCust ? (selectedCust.mobile || '') : '',
            contactEmail: selectedCust ? (selectedCust.email || '') : '',
            pincode: selectedCust?.billingAddress?.pincode || '',
            invoiceId: '',
            productId: '',
            assetId: '',
            serialNumber: ''
        }));
        setAssetSummary(null);
        setShowAllProducts(false);
        setGeneratedSerial('');
    };

    const handleManualCustomerChange = async (customerId) => {
        const selectedCust = customers.find(c => c._id === customerId);
        setManualFormData(prev => ({
            ...prev,
            customerId,
            customerName: selectedCust ? (selectedCust.companyName || selectedCust.customerName || '') : '',
            contactName: '',
            contactPhone: selectedCust ? (selectedCust.mobile || '') : '',
            contactEmail: selectedCust ? (selectedCust.email || '') : '',
            pincode: selectedCust?.billingAddress?.pincode || ''
        }));
        
        if (customerId) {
            try {
                const contactsRes = await csmService.getCustomerContacts({ customerId });
                const contacts = contactsRes.data || [];
                const primaryContact = contacts.find(c => c.isPrimary) || contacts[0];
                if (primaryContact) {
                    setManualFormData(prev => ({
                        ...prev,
                        contactName: primaryContact.contactName || '',
                        contactPhone: primaryContact.mobileNo || '',
                        contactEmail: primaryContact.email || ''
                    }));
                }
            } catch (err) {
                console.error('Error fetching contacts for manual customer:', err);
            }
        }
    };

    const handleSerialChange = (assetId) => {
        if (!assetId) {
            setFormData(prev => ({
                ...prev,
                assetId: '',
                serialNumber: ''
            }));
            setAssetSummary(null);
            return;
        }

        const selectedAsset = assets.find(a => a._id === assetId);
        if (!selectedAsset) return;

        setFormData(prev => ({
            ...prev,
            assetId,
            customerId: selectedAsset.customerId?._id || prev.customerId,
            productId: selectedAsset.productId?._id || prev.productId,
            serialNumber: selectedAsset.serialNumber || ''
        }));

        // Fetch asset summary
        csmService.getAssetSummary({ assetId })
            .then(res => {
                setAssetSummary(res.data);
                // Priority rule: if warranty and AMC are both expired, suggest Medium
                const hasCoverage = res.data.warranty?.status === 'Active' || res.data.amc?.status === 'Active';
                if (!hasCoverage) {
                    const medPriority = priorities.find(p => p.name?.toLowerCase() === 'medium');
                    if (medPriority) {
                        setFormData(prev => ({ ...prev, priorityId: medPriority._id }));
                    }
                }
            })
            .catch(err => {
                console.error('Error fetching asset summary:', err);
                setAssetSummary(null);
            });
    };

    const handleProductChange = (productId) => {
        if (!productId) {
            setFormData(prev => ({
                ...prev,
                productId: '',
                assetId: '',
                serialNumber: ''
            }));
            setAssetSummary(null);
            setGeneratedSerial('');
            return;
        }

        // Find if there is any matching asset for this product & customer
        const matchingAssets = assets.filter(a => 
            a.customerId?._id === formData.customerId && 
            a.productId?._id === productId
        );
        
        const autoAsset = matchingAssets.length > 0 ? matchingAssets[0] : null;
        
        setFormData(prev => ({
            ...prev,
            productId,
            assetId: autoAsset ? autoAsset._id : '',
            serialNumber: autoAsset ? autoAsset.serialNumber : ''
        }));
        
        if (autoAsset) {
            setGeneratedSerial('');
            // Fetch asset summary
            csmService.getAssetSummary({ assetId: autoAsset._id })
                .then(res => {
                    setAssetSummary(res.data);
                    const hasCoverage = res.data.warranty?.status === 'Active' || res.data.amc?.status === 'Active';
                    if (!hasCoverage) {
                        const medPriority = priorities.find(p => p.name?.toLowerCase() === 'medium');
                        if (medPriority) {
                            setFormData(prev => ({ ...prev, priorityId: medPriority._id }));
                        }
                    }
                })
                .catch(err => {
                    console.error('Error fetching asset summary:', err);
                    setAssetSummary(null);
                });
        } else {
            setAssetSummary(null);
            const selectedProd = products.find(p => p._id === productId);
            const prodCode = selectedProd?.productCode || 'PROD';
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            const tempSN = `SN-${prodCode.replace(/\s+/g, '')}-${randomNum}`;
            setGeneratedSerial(tempSN);
            setFormData(prev => ({ ...prev, serialNumber: tempSN }));
        }
    };

    const handleSubjectChange = (subjectVal) => {
        setFormData(prev => {
            const nextData = { ...prev, issueTitle: subjectVal };
            const subjectLower = subjectVal.toLowerCase();
            const highPriorityKeywords = ['crashed', 'down', 'not working', 'critical', 'stopped', 'broken', 'failure', 'error 500', 'out of service'];
            
            const hasHighKeyword = highPriorityKeywords.some(kw => subjectLower.includes(kw));
            if (hasHighKeyword) {
                const highPriority = priorities.find(p => p.name?.toLowerCase() === 'high' || p.name?.toLowerCase() === 'critical');
                if (highPriority) {
                    nextData.priorityId = highPriority._id;
                }
            }
            return nextData;
        });
    };

    const handleContactSelect = (contactId) => {
        if (!contactId) {
            setFormData(prev => ({
                ...prev,
                contactId: '',
                contactName: '',
                contactDesignationId: '',
                contactDesignation: '',
                contactPhone: '',
                contactEmail: ''
            }));
            return;
        }
        const contact = customerContacts.find(c => c._id === contactId);
        setFormData(prev => ({
            ...prev,
            contactId,
            contactName: contact?.contactName || '',
            contactDesignationId: contact?.designationId?._id || '',
            contactDesignation: contact?.designationId?.name || '',
            contactPhone: contact?.mobileNo || '',
            contactEmail: contact?.email || ''
        }));
    };

    const { isSubmitting: isSavingTicket, execute: handleCreateTicket } = useSubmitGuard(async (e) => {
        e.preventDefault();

        // Validation checks
        if (!formData.customerId) {
            toast.error('Customer is required');
            return;
        }
        if (!formData.productId) {
            toast.error('Product is required');
            return;
        }
        if (!formData.contactId) {
            toast.error('Contact Person is required');
            return;
        }
        if (!formData.issueTitle.trim()) {
            toast.error('Subject is required');
            return;
        }
        if (!formData.priorityId) {
            toast.error('Priority is required');
            return;
        }
        if (!formData.pincode || !formData.pincode.trim()) {
            toast.error('Pincode is required');
            return;
        }

        let assetIdToSubmit = formData.assetId;

        // If no assetId exists but we have a generatedSerial, create the asset first!
        if (!assetIdToSubmit && generatedSerial) {
            try {
                const assetRes = await csmService.createAsset({
                    customerId: formData.customerId,
                    productId: formData.productId,
                    serialNumber: generatedSerial,
                    location: 'Auto Generated'
                });
                assetIdToSubmit = assetRes.data._id;
                setAssets(prev => [...prev, assetRes.data]);
            } catch (err) {
                console.error('Error creating dynamic asset:', err);
                toast.error('Failed to register auto-generated serial number.');
                return;
            }
        }

        const cleanedFormData = { ...formData, assetId: assetIdToSubmit };
        const optionalObjectIdFields = ['contactId', 'contactDesignationId', 'productId', 'assetId', 'invoiceId'];
        optionalObjectIdFields.forEach(field => {
            if (cleanedFormData[field] === '') {
                cleanedFormData[field] = null;
            }
        });

        try {
            await csmService.createTicket(cleanedFormData);
            toast.success('Support ticket generated successfully!');
            setShowModal(false);
            fetchTickets();
            fetchTicketCustomers();
            setGeneratedSerial('');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error generating ticket');
        }
    });

    const handleImageUpload = async (key, file) => {
        if (!file) return;
        setUploadingImage(prev => ({ ...prev, [key]: true }));
        try {
            const res = await uploadService.uploadImage(file);
            const url = res.data.imageUrl || res.data.url || res.data.path;
            if (url) {
                setManualImages(prev => ({ ...prev, [key]: url }));
                toast.success(`${key.charAt(0).toUpperCase() + key.slice(1)} image uploaded successfully`);
            } else {
                toast.error('Failed to get uploaded image URL');
            }
        } catch (error) {
            console.error('Upload error:', error);
            toast.error(error.response?.data?.message || 'Failed to upload image');
        } finally {
            setUploadingImage(prev => ({ ...prev, [key]: false }));
        }
    };

    const { isSubmitting: isSavingManualTicket, execute: handleCreateManualTicket } = useSubmitGuard(async (e) => {
        e.preventDefault();
        if (!manualFormData.pincode || !manualFormData.pincode.trim()) {
            toast.error('Pincode is required');
            return;
        }
        try {
            // 1. Resolve Customer
            let customerId = '';
            if (!isManualCustomerText && manualFormData.customerId) {
                customerId = manualFormData.customerId;
            } else {
                const normCustName = manualFormData.customerName.trim();
                if (!normCustName) {
                    toast.error('Customer Name is required');
                    return;
                }

                const existingCust = customers.find(c => 
                    (c.customerName || '').toLowerCase() === normCustName.toLowerCase() || 
                    (c.companyName || '').toLowerCase() === normCustName.toLowerCase()
                );

                if (existingCust) {
                    customerId = existingCust._id;
                } else {
                    // Create customer on the fly
                    const newCustRes = await customerService.create({
                        customerName: normCustName,
                        companyName: normCustName,
                        mobile: manualFormData.contactPhone,
                        email: manualFormData.contactEmail
                    });
                    customerId = newCustRes.data._id;
                    setCustomers(prev => [...prev, newCustRes.data]);
                }
            }

            // 2. Resolve Category
            let categoryId = '';
            const selectedCatName = manualFormData.category;
            const matchedCat = categories.find(c => c.name.toLowerCase() === selectedCatName.toLowerCase());
            if (matchedCat) {
                categoryId = matchedCat._id;
            } else {
                const newCatRes = await csmService.createCategory({ name: selectedCatName });
                categoryId = newCatRes.data._id;
                setCategories(prev => [...prev, newCatRes.data]);
            }

            // 3. Resolve Priority
            let priorityId = '';
            const selectedPriName = manualFormData.priority;
            const matchedPri = priorities.find(p => p.name.toLowerCase() === selectedPriName.toLowerCase());
            if (matchedPri) {
                priorityId = matchedPri._id;
            } else {
                const newPriRes = await csmService.createPriority({ name: selectedPriName });
                priorityId = newPriRes.data._id;
                setPriorities(prev => [...prev, newPriRes.data]);
            }

            // 4. Resolve Type
            let typeId = '';
            const selectedTypeName = manualFormData.type;
            const matchedType = types.find(t => t.name.toLowerCase() === selectedTypeName.toLowerCase());
            if (matchedType) {
                typeId = matchedType._id;
            } else {
                const newTypeRes = await csmService.createType({ name: selectedTypeName });
                typeId = newTypeRes.data._id;
                setTypes(prev => [...prev, newTypeRes.data]);
            }

            // 5. Resolve Product (optional)
            let productId = (!isManualProductText && manualFormData.productId) ? manualFormData.productId : null;

            // 6. Resolve Asset (optional)
            let assetId = null;
            const cleanSerial = (manualFormData.serialNumber || '').trim();
            if (cleanSerial) {
                const existingAsset = assets.find(a => (a.serialNumber || '').toLowerCase() === cleanSerial.toLowerCase());
                if (existingAsset) {
                    assetId = existingAsset._id;
                } else if (productId) {
                    const newAssetRes = await csmService.createAsset({
                        customerId,
                        productId,
                        serialNumber: cleanSerial,
                        location: 'Manual Register'
                    });
                    assetId = newAssetRes.data._id;
                    setAssets(prev => [...prev, newAssetRes.data]);
                }
            }

            // 7. Construct description with uploads
            const imageUrls = Object.entries(manualImages)
                .filter(([_, url]) => url !== null)
                .map(([key, url]) => ({ label: key, url }));
                
            let description = manualFormData.description || '';
            if (imageUrls.length > 0) {
                description += '\n\n--- Uploaded Images ---';
                imageUrls.forEach(img => {
                    description += `\n• ${img.label.toUpperCase()}: ${img.url}`;
                });
            }

            // 8. Create Ticket
            const ticketPayload = {
                customerId,
                contactName: manualFormData.contactName,
                contactPhone: manualFormData.contactPhone,
                contactEmail: manualFormData.contactEmail,
                pincode: manualFormData.pincode,
                source: manualFormData.source,
                priorityId,
                categoryId,
                typeId,
                productId,
                assetId,
                issueTitle: manualFormData.issueTitle,
                description,
                invoiceId: null,
                isManual: true,
                manualInvoiceNo: manualFormData.invoiceNo,
                manualInvoiceDate: manualFormData.invoiceDate || null,
                manualProductName: (!isManualProductText && manualFormData.productId)
                    ? (products.find(p => p._id === manualFormData.productId)?.productName || '')
                    : (manualFormData.customProductName || '')
            };

            const ticketRes = await csmService.createTicket(ticketPayload);
            const ticketId = ticketRes.data._id;

            // 9. If there are uploaded files, add them as comment attachments
            const allUploadedUrls = Object.values(manualImages).filter(Boolean);
            if (allUploadedUrls.length > 0) {
                await csmService.addComment(ticketId, {
                    text: 'Manual ticket attachments: Device and/or Invoice images uploaded during registration.',
                    attachments: allUploadedUrls
                });
            }

            toast.success('Manual Support ticket registered successfully!');
            setShowManualModal(false);
            fetchTickets();
            fetchTicketCustomers();
            
            // Reset form
            setManualFormData({
                customerId: '',
                customerName: '',
                invoiceNo: '',
                invoiceDate: '',
                serialNumber: '',
                productId: '',
                customProductName: '',
                source: 'Phone',
                contactName: '',
                contactPhone: '',
                contactEmail: '',
                priority: 'Medium',
                category: 'Repair',
                type: 'Service',
                issueTitle: '',
                description: ''
            });
            setIsManualCustomerText(false);
            setIsManualProductText(false);
            setManualImages({
                front: null,
                back: null,
                left: null,
                right: null,
                invoice: null
            });

        } catch (error) {
            console.error('Error registering manual ticket:', error);
            toast.error(error.response?.data?.message || 'Failed to register manual ticket');
        }
    });

    const handleOpenManualViewModal = (ticket) => {
        setSelectedManualTicket(ticket);
        setShowManualViewModal(true);
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setPage(1);
        fetchTickets();
    };

    const handleSerialNoLookup = async (serialNo) => {
        const cleanSN = String(serialNo || '').trim();
        if (!cleanSN) return;
        
        try {
            const res = await csmService.getAssetSummary({ serialNumber: cleanSN });
            if (res.data && res.data.asset) {
                const asset = res.data.asset;
                setAssetSummary(res.data);
                setGeneratedSerial('');
                
                // Fetch invoices and contacts for this customer
                const invoiceRes = await voucherService.getAll({ customerId: asset.customerId?._id, voucherType: 'Invoice' });
                setInvoices(invoiceRes.data?.data || invoiceRes.data || []);
                
                const contactsRes = await csmService.getCustomerContacts({ customerId: asset.customerId?._id });
                setCustomerContacts(contactsRes.data || []);
                
                // Autofill
                setFormData(prev => {
                    const nextData = {
                        ...prev,
                        customerId: asset.customerId?._id || '',
                        productId: asset.productId?._id || '',
                        assetId: asset._id || '',
                        serialNumber: asset.serialNumber || cleanSN
                    };
                    
                    // Autofill contact if we have contacts and primary exists
                    if (contactsRes.data && contactsRes.data.length > 0) {
                        const primaryContact = contactsRes.data.find(c => c.isPrimary) || contactsRes.data[0];
                        if (primaryContact) {
                            nextData.contactId = primaryContact._id;
                            nextData.contactName = primaryContact.contactName || '';
                            nextData.contactDesignationId = primaryContact.designationId?._id || '';
                            nextData.contactDesignation = primaryContact.designationId?.name || '';
                            nextData.contactPhone = primaryContact.mobileNo || '';
                            nextData.contactEmail = primaryContact.email || '';
                        }
                    }
                    
                    return nextData;
                });
                
                toast.success(`Asset found! Auto-filled details for Serial No: ${cleanSN}`);
                
                // Check coverage & adjust priority
                const hasCoverage = res.data.warranty?.status === 'Active' || res.data.amc?.status === 'Active';
                if (!hasCoverage) {
                    const medPriority = priorities.find(p => p.name?.toLowerCase() === 'medium');
                    if (medPriority) {
                        setFormData(prev => ({ ...prev, priorityId: medPriority._id }));
                    }
                }
            } else {
                toast.info('No matching registered asset/serial number found. You can enter details manually.');
            }
        } catch (err) {
            console.error('Error looking up serial number:', err);
            toast.error('Failed to lookup serial number');
        }
    };

    const exportToExcel = async () => {
        setLoading(true);
        try {
            const res = await csmService.getTickets({
                limit: 10000,
                search,
                status: filterStatus,
                priorityId: filterPriority
            });
            
            const exportTickets = res.data?.data || [];
            if (!exportTickets.length) {
                toast.info('No tickets found to export');
                return;
            }

            const exportData = exportTickets.map((t) => ({
                'Ticket No': t.ticketNo || '',
                'Customer Name': t.customerId?.companyName || t.customerId?.customerName || '',
                'Customer Email': t.customerId?.email || '',
                'Customer Phone': t.customerId?.mobile || '',
                'Contact Person': t.contactName || '',
                'Contact Phone': t.contactPhone || '',
                'Contact Email': t.contactEmail || '',
                'Product Name': t.productId?.productName || '',
                'Product Code': t.productId?.productCode || '',
                'Serial No': t.assetId?.serialNumber || '',
                'Subject': t.issueTitle || '',
                'Description': t.description || '',
                'Priority': t.priorityId?.name || '',
                'Category': t.categoryId?.name || '',
                'Type': t.typeId?.name || '',
                'Status': t.status || '',
                'Source': t.source || '',
                'Issue Date': t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN') : '',
                'Resolved Date': t.resolvedAt ? new Date(t.resolvedAt).toLocaleDateString('en-IN') : '',
                'Assigned Engineer': t.assignedEngineerId?.name || 'Unassigned'
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Tickets');
            XLSX.writeFile(wb, `Support_Tickets_${new Date().toISOString().slice(0, 10)}.xlsx`);
            toast.success('Export completed successfully');
        } catch (err) {
            console.error('Export tickets error:', err);
            toast.error('Failed to export tickets');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const blobRes = await importService.getTicketTemplate();
            const url = window.URL.createObjectURL(new Blob([blobRes.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `ticket_import_template.xlsx`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success('Ticket template downloaded successfully!');
        } catch (error) {
            console.error('Error downloading template:', error);
            toast.error('Failed to download Excel template.');
        }
    };

    const handleImportFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        try {
            const res = await importService.importTickets(file);
            
            setImportResult({
                type: 'ticket',
                imported: res.data.imported || 0,
                updated: res.data.updated || 0,
                skipped: res.data.skipped || 0,
                failed: res.data.failed || 0,
                errors: res.data.errors || []
            });
            setShowImportResultModal(true);

            // Reload tickets
            fetchTickets();
            fetchTicketCustomers();

            if (res.data.success) {
                toast.success('Import completed successfully!');
            } else {
                toast.warning('Import completed with some errors. Please check the summary report.');
            }
        } catch (error) {
            console.error('Import error:', error);
            toast.error(error.response?.data?.message || 'Error occurred during import');
        } finally {
            setLoading(false);
            e.target.value = ''; // Reset file input
        }
    };

    const downloadErrorReport = () => {
        if (!importResult || !importResult.errors || importResult.errors.length === 0) return;
        const blobContent = `Import Error Report for Tickets\nGenerated on: ${new Date().toLocaleString()}\n\nFailed rows details:\n` + importResult.errors.join('\n');
        const url = window.URL.createObjectURL(new Blob([blobContent], { type: 'text/plain' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `ticket_import_errors.txt`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleOpenMiniMaster = (type) => {
        setMiniMasterFormData({
            name: '',
            description: '',
            responseSlaHours: '1',
            resolutionSlaHours: '4',
            color: '#3b82f6'
        });
        setMiniMasterSearch('');
        setEditingItemId(null);
        setActiveMiniMaster(type);
    };

    const handleDeleteMiniMaster = async (id) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;
        try {
            if (activeMiniMaster === 'source') {
                await csmService.deleteSource(id);
                toast.success('Source deleted');
                const res = await csmService.getSources();
                setSources(res.data || []);
                setFormData(prev => ({ ...prev, source: prev.source === id ? '' : prev.source }));
            } else if (activeMiniMaster === 'category') {
                await csmService.deleteCategory(id);
                toast.success('Category deleted');
                const res = await csmService.getCategories();
                setCategories(res.data || []);
                setFormData(prev => ({ ...prev, categoryId: prev.categoryId === id ? '' : prev.categoryId }));
            } else if (activeMiniMaster === 'type') {
                await csmService.deleteType(id);
                toast.success('Ticket type deleted');
                const res = await csmService.getTypes();
                setTypes(res.data || []);
                setFormData(prev => ({ ...prev, typeId: prev.typeId === id ? '' : prev.typeId }));
            } else if (activeMiniMaster === 'priority') {
                await csmService.deletePriority(id);
                toast.success('Priority deleted');
                const res = await csmService.getPriorities();
                setPriorities(res.data || []);
                setFormData(prev => ({ ...prev, priorityId: prev.priorityId === id ? '' : prev.priorityId }));
            } else if (activeMiniMaster === 'designation') {
                await csmService.deleteDesignation(id);
                toast.success('Designation deleted');
                const res = await csmService.getDesignations();
                setDesignations(res.data || []);
                setFormData(prev => ({
                    ...prev,
                    contactDesignationId: prev.contactDesignationId === id ? '' : prev.contactDesignationId,
                    contactDesignation: prev.contactDesignationId === id ? '' : prev.contactDesignation
                }));
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete');
        }
    };

    const handleStartEditMiniMaster = (item) => {
        setEditingItemId(item._id);
        setEditingItemFormData({
            name: item.name || '',
            description: item.description || '',
            responseSlaHours: item.responseSlaHours || '1',
            resolutionSlaHours: item.resolutionSlaHours || '4',
            color: item.color || '#3b82f6'
        });
    };

    const handleSaveEditMiniMaster = async (e, id) => {
        e.preventDefault();
        try {
            if (activeMiniMaster === 'source') {
                await csmService.updateSource(id, { name: editingItemFormData.name });
                toast.success('Source updated');
                const res = await csmService.getSources();
                setSources(res.data || []);
            } else if (activeMiniMaster === 'category') {
                await csmService.updateCategory(id, {
                    name: editingItemFormData.name,
                    description: editingItemFormData.description
                });
                toast.success('Category updated');
                const res = await csmService.getCategories();
                setCategories(res.data || []);
            } else if (activeMiniMaster === 'type') {
                await csmService.updateType(id, {
                    name: editingItemFormData.name,
                    description: editingItemFormData.description
                });
                toast.success('Ticket type updated');
                const res = await csmService.getTypes();
                setTypes(res.data || []);
            } else if (activeMiniMaster === 'priority') {
                await csmService.updatePriority(id, {
                    name: editingItemFormData.name,
                    responseSlaHours: Number(editingItemFormData.responseSlaHours),
                    resolutionSlaHours: Number(editingItemFormData.resolutionSlaHours),
                    color: editingItemFormData.color
                });
                toast.success('Priority updated');
                const res = await csmService.getPriorities();
                setPriorities(res.data || []);
            } else if (activeMiniMaster === 'designation') {
                await csmService.updateDesignation(id, {
                    name: editingItemFormData.name,
                    description: editingItemFormData.description
                });
                toast.success('Designation updated');
                const res = await csmService.getDesignations();
                setDesignations(res.data || []);
            }
            setEditingItemId(null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update');
        }
    };

    const handleSelectMiniMasterItem = (item) => {
        if (showManualModal) {
            if (activeMiniMaster === 'source') {
                setManualFormData(prev => ({ ...prev, source: item.name }));
            } else if (activeMiniMaster === 'category') {
                setManualFormData(prev => ({ ...prev, category: item.name }));
            } else if (activeMiniMaster === 'type') {
                setManualFormData(prev => ({ ...prev, type: item.name }));
            } else if (activeMiniMaster === 'priority') {
                setManualFormData(prev => ({ ...prev, priority: item.name }));
            }
        } else {
            if (activeMiniMaster === 'source') {
                setFormData(prev => ({ ...prev, source: item.name }));
            } else if (activeMiniMaster === 'category') {
                setFormData(prev => ({ ...prev, categoryId: item._id }));
            } else if (activeMiniMaster === 'type') {
                setFormData(prev => ({ ...prev, typeId: item._id }));
            } else if (activeMiniMaster === 'priority') {
                setFormData(prev => ({ ...prev, priorityId: item._id }));
            } else if (activeMiniMaster === 'designation') {
                setFormData(prev => ({
                    ...prev,
                    contactDesignationId: item._id,
                    contactDesignation: item.name
                }));
            }
        }
        setActiveMiniMaster(null);
    };

    const handleCreateCustomerContact = async (e) => {
        e.preventDefault();
        if (!formData.customerId) {
            toast.error('Select a customer first');
            return;
        }

        try {
            const res = await csmService.createCustomerContact({
                customerId: formData.customerId,
                ...contactFormData
            });
            const contactsRes = await csmService.getCustomerContacts({ customerId: formData.customerId });
            setCustomerContacts(contactsRes.data || []);
            setFormData(prev => ({
                ...prev,
                contactId: res.data._id,
                contactName: res.data.contactName || '',
                contactDesignationId: res.data.designationId?._id || '',
                contactDesignation: res.data.designationId?.name || '',
                contactPhone: res.data.mobileNo || '',
                contactEmail: res.data.email || ''
            }));
            setShowContactModal(false);
            setContactFormData({
                contactName: '',
                designationId: '',
                mobileNo: '',
                email: '',
                isPrimary: false
            });
            toast.success('Customer contact added');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add customer contact');
        }
    };

    const handleCreateMiniMaster = async (e) => {
        e.preventDefault();
        try {
            let res;
            if (activeMiniMaster === 'source') {
                res = await csmService.createSource({ name: miniMasterFormData.name });
                toast.success('Ticket source added!');
                const srcRes = await csmService.getSources();
                setSources(srcRes.data || []);
                if (showManualModal) {
                    setManualFormData(prev => ({ ...prev, source: miniMasterFormData.name }));
                } else {
                    setFormData(prev => ({ ...prev, source: miniMasterFormData.name }));
                }
            } else if (activeMiniMaster === 'category') {
                res = await csmService.createCategory({
                    name: miniMasterFormData.name,
                    description: miniMasterFormData.description
                });
                toast.success('Category added!');
                const catRes = await csmService.getCategories();
                setCategories(catRes.data || []);
                if (showManualModal) {
                    setManualFormData(prev => ({ ...prev, category: res.data.name }));
                } else {
                    setFormData(prev => ({ ...prev, categoryId: res.data._id }));
                }
            } else if (activeMiniMaster === 'type') {
                res = await csmService.createType({
                    name: miniMasterFormData.name,
                    description: miniMasterFormData.description
                });
                toast.success('Ticket type added!');
                const typRes = await csmService.getTypes();
                setTypes(typRes.data || []);
                if (showManualModal) {
                    setManualFormData(prev => ({ ...prev, type: res.data.name }));
                } else {
                    setFormData(prev => ({ ...prev, typeId: res.data._id }));
                }
            } else if (activeMiniMaster === 'priority') {
                res = await csmService.createPriority({
                    name: miniMasterFormData.name,
                    responseSlaHours: Number(miniMasterFormData.responseSlaHours),
                    resolutionSlaHours: Number(miniMasterFormData.resolutionSlaHours),
                    color: miniMasterFormData.color
                });
                toast.success('Priority tier added!');
                const priRes = await csmService.getPriorities();
                setPriorities(priRes.data || []);
                if (showManualModal) {
                    setManualFormData(prev => ({ ...prev, priority: res.data.name }));
                } else {
                    setFormData(prev => ({ ...prev, priorityId: res.data._id }));
                }
            } else if (activeMiniMaster === 'designation') {
                res = await csmService.createDesignation({
                    name: miniMasterFormData.name,
                    description: miniMasterFormData.description
                });
                toast.success('Designation added!');
                const desRes = await csmService.getDesignations();
                setDesignations(desRes.data || []);
                setFormData(prev => ({
                    ...prev,
                    contactDesignationId: res.data._id,
                    contactDesignation: res.data.name
                }));
            }
            setActiveMiniMaster(null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add item');
        }
    };

    const selectedPriorityInfo = priorities.find(p => p._id === formData.priorityId);

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in-up">
            {/* Header */}
            {pageView === 'list' && (<>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 font-outfit uppercase">
                        Support Tickets Register
                    </h1>
                    <p className="text-slate-500 font-semibold text-sm">
                        Create, track, and manage customer service cases.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => {
                            const lowPriority = priorities.find(p => p.name?.toLowerCase() === 'low');
                            setFormData({
                                customerId: '',
                                contactId: '',
                                contactName: '',
                                contactDesignationId: '',
                                contactDesignation: '',
                                contactPhone: '',
                                contactEmail: '',
                                priorityId: lowPriority ? lowPriority._id : '',
                                categoryId: '',
                                typeId: '',
                                productId: '',
                                assetId: '',
                                invoiceId: '',
                                issueTitle: '',
                                description: '',
                                source: 'Web Portal',
                                serialNumber: ''
                            });
                            setCustomerContacts([]);
                            setAssetSummary(null);
                            setShowAllProducts(false);
                            setGeneratedSerial('');
                            setPageView('standard');
                        }}
                        className="flex items-center gap-2 px-6 py-4 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-lg shadow-primary-600/20 active:scale-95 self-start md:self-auto"
                    >
                        <MdAdd size={18} />
                        New Ticket
                    </button>

                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-2 px-5 py-4 bg-white hover:bg-slate-50 text-slate-700 font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all border border-slate-200 shadow-sm active:scale-95"
                    >
                        <MdFileDownload size={18} />
                        Export
                    </button>

                    <label className="flex items-center gap-2 px-5 py-4 bg-slate-800 hover:bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-md cursor-pointer active:scale-95">
                        <MdPublish size={18} />
                        Import
                        <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleImportFile}
                            className="hidden"
                        />
                    </label>

                    <button
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-2 px-5 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all border border-slate-200 active:scale-95"
                    >
                        <MdFileDownload size={18} />
                        Template
                    </button>
                </div>
            </div>

            {/* Filters Toolbar */}
            <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between relative z-20">
                <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
                    <input
                        type="text"
                        placeholder="Search ticket no, title, contact..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                    />
                    <MdSearch className="absolute left-4 top-3.5 text-slate-400" size={20} />
                </form>
                <div className="flex flex-wrap items-center gap-3">
                    {/* Customer Filter */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-1">
                        <MdFilterList className="text-slate-400" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-400">Customer</span>
                        <SearchableSelect
                            options={ticketCustomers.map(c => ({
                                value: c._id,
                                label: c.companyName || c.customerName
                            }))}
                            value={filterCustomer}
                            onChange={(val) => { setFilterCustomer(val); setPage(1); }}
                            placeholder="All Customers"
                            inputClass="bg-transparent border-none outline-none text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-1 max-w-[180px] truncate"
                            menuClass="w-64"
                        />
                    </div>

                    {/* Invoice Type Filter */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-1.5">
                        <MdFilterList className="text-slate-400" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-400">Ticket Type</span>
                        <select
                            value={filterInvoiceType}
                            onChange={(e) => { setFilterInvoiceType(e.target.value); setPage(1); }}
                            className="bg-transparent border-none focus:outline-none text-xs font-bold text-slate-700 cursor-pointer"
                        >
                            <option value="">All Tickets</option>
                            <option value="standard">System Tickets</option>
                            <option value="manual">Manual Tickets</option>
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-1.5">
                        <MdFilterList className="text-slate-400" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-400">Status</span>
                        <select
                            value={filterStatus}
                            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                            className="bg-transparent border-none focus:outline-none text-xs font-bold text-slate-700 cursor-pointer"
                        >
                            <option value="">All Statuses</option>
                            <option value="Open">Open</option>
                            <option value="Assigned">Assigned</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Pending Customer">Pending Customer</option>
                            <option value="Resolved">Resolved</option>
                            <option value="Closed">Closed</option>
                            <option value="Escalated">Escalated</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table Card */}
            <div className="glass shadow-premium rounded-[2rem] p-6 bg-white border border-slate-100">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-3">
                        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Fetching Tickets...</p>
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                        <p className="text-lg font-bold">No support tickets found.</p>
                        <p className="text-sm">Refine your search parameters or raise a new ticket.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                        <th className="px-6 py-4">Ticket No</th>
                                        <th className="px-6 py-4">Customer & Contact</th>
                                        <th className="px-6 py-4">Subject</th>
                                        <th className="px-6 py-4">Priority</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Engineer</th>
                                        <th className="px-6 py-4 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-sm font-semibold text-slate-700">
                                    {tickets.map((t) => {
                                        const isManual = t.isManual || !!t.manualInvoiceNo || (t.description && t.description.includes('--- Uploaded Images ---'));
                                        return (
                                            <tr key={t._id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4 font-black text-slate-900">
                                                    <div>{t.ticketNo}</div>
                                                    <span className={`inline-block mt-1 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                                                        isManual 
                                                            ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                                                    }`}>
                                                        {isManual ? 'Manual' : 'System'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-slate-900">{t.customerId?.customerName || 'N/A'}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                        {t.contactName || t.contactPhone || 'No Contact'}
                                                        {t.pincode ? ` | Pin: ${t.pincode}` : ''}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4 max-w-xs truncate">{t.issueTitle}</td>
                                                <td className="px-6 py-4">
                                                    <span 
                                                        className="px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm"
                                                        style={{ backgroundColor: t.priorityId?.color || '#64748b' }}
                                                    >
                                                        {t.priorityId?.name || 'Medium'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${statusStyles[t.status] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                                        {t.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500">
                                                    <div>{t.assignedEngineerId?.name || 'Unassigned'}</div>
                                                    {t.assignedSalespersonId && (
                                                        <div className="text-[10px] text-primary-600 font-black uppercase tracking-tight mt-1">
                                                            Sales rep: {t.assignedSalespersonId.name}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center items-center gap-2">
                                                        {isManual && (
                                                            <button
                                                                onClick={() => handleOpenManualViewModal(t)}
                                                                className="flex items-center gap-1 px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-sm"
                                                            >
                                                                View
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => navigate(`/csm/tickets/${t._id}`)}
                                                            className="flex items-center gap-1.5 px-4 py-2 hover:bg-primary-50 text-primary-600 rounded-xl transition-all hover:scale-105 active:scale-95"
                                                        >
                                                            Details
                                                            <MdArrowForward />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <PaginationControls
                            page={page}
                            totalPages={totalPages}
                            onPageChange={(p) => setPage(p)}
                        />
                    </div>
                )}
            </div>
            </>)}

            {/* Standard Ticket Creation - Full Page View */}
            {pageView === 'standard' && (
                <div className="space-y-6 animate-fade-in-up">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <button
                                type="button"
                                onClick={() => setPageView('list')}
                                className="text-xs font-black uppercase tracking-widest text-primary-600 hover:text-primary-700 mb-2 flex items-center gap-1 transition-all"
                            >
                                ← Back to Tickets
                            </button>
                            <h1 className="text-3xl font-black tracking-tight text-slate-900 font-outfit uppercase">
                                Raise Support Ticket
                            </h1>
                            <p className="text-slate-500 font-semibold text-sm">Fill in the details to create a new support ticket.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setPageView('manual');
                                }}
                                className="px-6 py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-slate-800/10"
                            >
                                Manual Register
                            </button>
                            <button
                                type="button"
                                onClick={() => setPageView('list')}
                                className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="create-ticket-form"
                                disabled={isSavingTicket}
                                className="px-6 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSavingTicket ? 'Raising...' : 'Raise Ticket'}
                            </button>
                        </div>
                    </div>
                    <div className="glass shadow-premium rounded-[2rem] p-6 md:p-8 bg-white border border-slate-100">
                    <form id="create-ticket-form" onSubmit={handleCreateTicket} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer *</label>
                            <SearchableSelect
                                options={customers.map(c => ({
                                    value: c._id,
                                    label: c.companyName && c.companyName !== c.customerName 
                                        ? `${c.companyName} (${c.customerName})` 
                                        : c.companyName || c.customerName
                                }))}
                                value={formData.customerId}
                                onChange={handleCustomerChange}
                                placeholder="Search & Select Customer..."
                            />
                            {(() => {
                                const selectedCust = customers.find(c => c._id === formData.customerId);
                                if (!selectedCust) return null;
                                return (
                                    <div className="mt-3 p-3.5 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-1.5 text-xs animate-fade-in">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">GSTIN</span>
                                            <span className="text-slate-700 font-mono font-bold">{selectedCust.gstin || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Phone</span>
                                            <span className="text-slate-700 font-bold">{selectedCust.mobile || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Email</span>
                                            <span className="text-slate-700 font-bold break-all">{selectedCust.email || 'N/A'}</span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                Link Invoice {formData.customerId ? `(${invoices.length})` : ''}
                            </label>
                            <select
                                value={formData.invoiceId}
                                disabled={!formData.customerId}
                                onChange={(e) => {
                                    const nextInvoiceId = e.target.value;
                                    setFormData(prev => {
                                        const nextData = { ...prev, invoiceId: nextInvoiceId };
                                        if (nextInvoiceId) {
                                            const selectedInvoice = invoices.find(i => i._id === nextInvoiceId);
                                            const invoiceProductIds = selectedInvoice ? selectedInvoice.items.map(item => item.productId?.toString()).filter(Boolean) : [];
                                            if (prev.productId && !invoiceProductIds.includes(prev.productId.toString())) {
                                                nextData.productId = '';
                                                nextData.assetId = '';
                                            }
                                        }
                                        return nextData;
                                    });
                                }}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold disabled:bg-slate-50 disabled:text-slate-400"
                            >
                                <option value="">{formData.customerId ? `Select Invoice (${invoices.length} available)` : 'Select Customer First'}</option>
                                {invoices.map(i => <option key={i._id} value={i._id}>{i.voucherNumber} ({new Date(i.date).toLocaleDateString()})</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pincode *</label>
                            <input
                                type="text"
                                required
                                value={formData.pincode || ''}
                                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                placeholder="Enter Pincode"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Link Product *</label>
                                {formData.customerId && assets.some(a => a.customerId?._id === formData.customerId) && (
                                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showAllProducts}
                                            onChange={(e) => setShowAllProducts(e.target.checked)}
                                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-3.5 w-3.5"
                                        />
                                        Show All Products
                                    </label>
                                )}
                            </div>
                            <SearchableSelect
                                options={
                                    (() => {
                                        if (formData.invoiceId) {
                                            const selectedInvoice = invoices.find(i => i._id === formData.invoiceId);
                                            if (selectedInvoice) {
                                                return selectedInvoice.items.map(item => ({
                                                    value: item.productId?.toString() || item._id?.toString(),
                                                    label: item.productName
                                                }));
                                            }
                                            return [];
                                        } else {
                                            const customerHasAssets = formData.customerId && assets.some(a => a.customerId?._id === formData.customerId);
                                            const filteredProds = (formData.customerId && customerHasAssets && !showAllProducts)
                                                ? products.filter(p => assets.some(a => a.customerId?._id === formData.customerId && a.productId?._id === p._id))
                                                : products;
                                            return filteredProds.map(p => ({
                                                value: p._id,
                                                label: `${p.productName} (${p.productCode})`
                                            }));
                                        }
                                    })()
                                }
                                value={formData.productId}
                                onChange={handleProductChange}
                                placeholder="Search & Select Product..."
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Product Serial No.</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={formData.serialNumber || ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setFormData(prev => ({ ...prev, serialNumber: val }));
                                    }}
                                    onBlur={() => handleSerialNoLookup(formData.serialNumber)}
                                    className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                                    placeholder="Enter or scan Product Serial No."
                                />
                                <button
                                    type="button"
                                    onClick={() => handleSerialNoLookup(formData.serialNumber)}
                                    className="absolute right-2 top-1.5 p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg transition-all"
                                    title="Lookup Serial Number"
                                >
                                    <MdSearch size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Asset Lookup Card */}
                        {assetSummary && (
                            <div className="md:col-span-2 p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200 rounded-3xl space-y-3 shadow-sm animate-fade-in">
                                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-700">🔎 Asset Information Lookup</span>
                                    <div className="flex gap-2">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                            assetSummary.asset?.status === 'SOLD'
                                                ? 'bg-blue-50 text-blue-600 border-blue-200'
                                                : assetSummary.asset?.status === 'IN_STOCK'
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                        }`}>
                                            Status: {assetSummary.asset?.status || 'IN_STOCK'}
                                        </span>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                            assetSummary.warranty?.status === 'Active' || assetSummary.amc?.status === 'Active'
                                                ? 'bg-teal-50 text-teal-600 border-teal-200'
                                                : 'bg-rose-50 text-rose-500 border-rose-200'
                                        }`}>
                                            {assetSummary.warranty?.status === 'Active' || assetSummary.amc?.status === 'Active' ? 'Covered' : 'Out of Warranty/AMC'}
                                        </span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs font-semibold text-slate-600">
                                    <div>
                                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Customer</span>
                                        <span className="text-slate-900">{assetSummary.asset?.customerId?.companyName || assetSummary.asset?.customerId?.customerName || 'Stock (Unsold)'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Product</span>
                                        <span className="text-slate-900">{assetSummary.asset?.productId?.productName}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Serial Number</span>
                                        <span className="text-slate-900 font-mono">{assetSummary.asset?.serialNumber}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Invoice Number</span>
                                        <span className="text-slate-900">{assetSummary.asset?.invoiceNumber || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Date of Sale</span>
                                        <span className="text-slate-900">
                                            {assetSummary.asset?.saleDate || assetSummary.asset?.invoiceDate
                                                ? new Date(assetSummary.asset.saleDate || assetSummary.asset.invoiceDate).toLocaleDateString('en-IN')
                                                : 'N/A'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Installation Date</span>
                                        <span className="text-slate-900">{assetSummary.asset?.installationDate ? new Date(assetSummary.asset.installationDate).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Warranty Status</span>
                                        <span className={assetSummary.warranty?.status === 'Active' ? 'text-teal-600 font-bold' : 'text-slate-500'}>
                                            {assetSummary.warranty?.status === 'Active' ? `✅ Active (Expires ${new Date(assetSummary.warranty.expiryDate).toLocaleDateString()})` : '❌ Inactive / Expired'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">AMC Status</span>
                                        <span className={assetSummary.amc?.status === 'Active' ? 'text-teal-600 font-bold' : 'text-slate-500'}>
                                            {assetSummary.amc?.status === 'Active' ? `✅ Active (${assetSummary.amc.contractNo})` : '❌ Inactive / Expired'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Last Service Date</span>
                                        <span className="text-slate-900">{assetSummary.lastServiceDate ? new Date(assetSummary.lastServiceDate).toLocaleDateString() : 'No service record'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Open Tickets</span>
                                        <span className="text-amber-600 font-bold">{assetSummary.ticketCounts?.open || 0}</span>
                                    </div>
                                    <div>
                                        <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Closed Tickets</span>
                                        <span className="text-slate-500">{assetSummary.ticketCounts?.closed || 0}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket Source</label>
                                <button 
                                    type="button" 
                                    onClick={() => handleOpenMiniMaster('source')}
                                    className="text-[10px] font-black uppercase text-primary-600 hover:text-primary-700 tracking-wider flex items-center gap-0.5"
                                >
                                    + Quick Add
                                </button>
                            </div>
                            <select
                                value={formData.source}
                                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                            >
                                <option value="">Select Source</option>
                                {sources.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Person Name *</label>
                                <button
                                    type="button"
                                    onClick={() => setShowContactModal(true)}
                                    disabled={!formData.customerId}
                                    className="text-[10px] font-black uppercase text-primary-600 hover:text-primary-700 tracking-wider flex items-center gap-0.5 disabled:text-slate-300"
                                >
                                    + Quick Add
                                </button>
                            </div>
                            <SearchableSelect
                                options={customerContacts.map(c => ({
                                    value: c._id,
                                    label: `${c.contactName}${c.isPrimary ? ' (Primary)' : ''}`
                                }))}
                                value={formData.contactId}
                                onChange={handleContactSelect}
                                placeholder={formData.customerId ? "Search & Select Contact..." : "Select Customer First"}
                            />
                            {formData.customerId && customerContacts.length === 0 && (
                                <p className="text-[10px] font-bold text-amber-600 mt-1">No contacts saved for this customer yet.</p>
                            )}
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Designation</label>
                                <button 
                                    type="button" 
                                    onClick={() => handleOpenMiniMaster('designation')}
                                    className="text-[10px] font-black uppercase text-primary-600 hover:text-primary-700 tracking-wider flex items-center gap-0.5"
                                >
                                    + Quick Add
                                </button>
                            </div>
                            <select
                                value={formData.contactDesignationId}
                                disabled={Boolean(formData.contactId)}
                                onChange={(e) => {
                                    const designation = designations.find(d => d._id === e.target.value);
                                    setFormData({
                                        ...formData,
                                        contactDesignationId: e.target.value,
                                        contactDesignation: designation?.name || ''
                                    });
                                }}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold disabled:bg-slate-50 disabled:text-slate-400"
                            >
                                <option value="">Select Designation</option>
                                {designations.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact Phone</label>
                            <input
                                type="text"
                                value={formData.contactPhone}
                                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50 disabled:opacity-75"
                                disabled={Boolean(formData.contactId)}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact Email</label>
                            <input
                                type="email"
                                value={formData.contactEmail}
                                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50 disabled:opacity-75"
                                disabled={Boolean(formData.contactId)}
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Priority *</label>
                                <button 
                                    type="button" 
                                    onClick={() => handleOpenMiniMaster('priority')}
                                    className="text-[10px] font-black uppercase text-primary-600 hover:text-primary-700 tracking-wider flex items-center gap-0.5"
                                >
                                    + Quick Add
                                </button>
                            </div>
                            <select
                                required
                                value={formData.priorityId}
                                onChange={(e) => setFormData({ ...formData, priorityId: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                            >
                                <option value="">Select Priority</option>
                                {priorities.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Category *</label>
                                <button 
                                    type="button" 
                                    onClick={() => handleOpenMiniMaster('category')}
                                    className="text-[10px] font-black uppercase text-primary-600 hover:text-primary-700 tracking-wider flex items-center gap-0.5"
                                >
                                    + Quick Add
                                </button>
                            </div>
                            <select
                                required
                                value={formData.categoryId}
                                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                            >
                                <option value="">Select Category</option>
                                {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket Type *</label>
                                <button 
                                    type="button" 
                                    onClick={() => handleOpenMiniMaster('type')}
                                    className="text-[10px] font-black uppercase text-primary-600 hover:text-primary-700 tracking-wider flex items-center gap-0.5"
                                >
                                    + Quick Add
                                </button>
                            </div>
                            <select
                                required
                                value={formData.typeId}
                                onChange={(e) => setFormData({ ...formData, typeId: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                            >
                                <option value="">Select Type</option>
                                {types.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                            </select>
                        </div>
                        
                        {/* SLA Preview box */}
                        {selectedPriorityInfo && (
                            <div className="md:col-span-2 p-4 bg-teal-50 border border-teal-200 rounded-2xl flex items-center justify-between text-xs text-teal-800 font-bold">
                                <span>⏰ SLA Configuration Applied:</span>
                                <span>First Response: {selectedPriorityInfo.responseSlaHours} hrs</span>
                                <span>Resolution: {selectedPriorityInfo.resolutionSlaHours} hrs</span>
                            </div>
                        )}

                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Subject *</label>
                            <input
                                type="text"
                                required
                                value={formData.issueTitle}
                                onChange={(e) => handleSubjectChange(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Description / Notes</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold h-24"
                            />
                        </div>
                    </div>
                </form>
                    </div>
                </div>
            )}

            <Modal
                isOpen={showContactModal}
                onClose={() => setShowContactModal(false)}
                title="Add Customer Contact"
                maxWidth="max-w-md"
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => setShowContactModal(false)}
                            className="w-full md:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="customer-contact-form"
                            className="w-full md:w-auto px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary-600/20"
                        >
                            Save Contact
                        </button>
                    </>
                }
            >
                <form id="customer-contact-form" onSubmit={handleCreateCustomerContact} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact Person Name *</label>
                        <input
                            type="text"
                            required
                            value={contactFormData.contactName}
                            onChange={(e) => setContactFormData({ ...contactFormData, contactName: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Designation</label>
                        <select
                            value={contactFormData.designationId}
                            onChange={(e) => setContactFormData({ ...contactFormData, designationId: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        >
                            <option value="">Select Designation</option>
                            {designations.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mobile Number</label>
                        <input
                            type="text"
                            value={contactFormData.mobileNo}
                            onChange={(e) => setContactFormData({ ...contactFormData, mobileNo: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email Address</label>
                        <input
                            type="email"
                            value={contactFormData.email}
                            onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold"
                        />
                    </div>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <input
                            type="checkbox"
                            checked={contactFormData.isPrimary}
                            onChange={(e) => setContactFormData({ ...contactFormData, isPrimary: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-primary-600"
                        />
                        Mark as primary contact
                    </label>
                </form>
            </Modal>

            {/* Mini Master Modal */}
            <Modal
                isOpen={activeMiniMaster !== null}
                onClose={() => setActiveMiniMaster(null)}
                title={`Manage ${activeMiniMaster ? activeMiniMaster.charAt(0).toUpperCase() + activeMiniMaster.slice(1) + 's' : ''}`}
                maxWidth="max-w-md"
                footer={
                    <button
                        type="button"
                        onClick={() => setActiveMiniMaster(null)}
                        className="w-full md:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                        Close
                    </button>
                }
            >
                <div className="space-y-4">
                    {/* Search Field */}
                    <div>
                        <input
                            type="text"
                            placeholder="Search existing..."
                            value={miniMasterSearch}
                            onChange={(e) => setMiniMasterSearch(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>

                    {/* Add New Form inline */}
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Add New Entry</p>
                        <div className="grid grid-cols-1 gap-3">
                            <input
                                type="text"
                                placeholder="Name/Value *"
                                required
                                value={miniMasterFormData.name}
                                onChange={(e) => setMiniMasterFormData({ ...miniMasterFormData, name: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-white"
                            />
                            {(activeMiniMaster === 'category' || activeMiniMaster === 'type' || activeMiniMaster === 'designation') && (
                                <input
                                    type="text"
                                    placeholder="Description"
                                    value={miniMasterFormData.description}
                                    onChange={(e) => setMiniMasterFormData({ ...miniMasterFormData, description: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-white"
                                />
                            )}
                            {activeMiniMaster === 'priority' && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Response SLA (Hrs)</label>
                                            <input
                                                type="number"
                                                required
                                                min="1"
                                                value={miniMasterFormData.responseSlaHours}
                                                onChange={(e) => setMiniMasterFormData({ ...miniMasterFormData, responseSlaHours: e.target.value })}
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Resolution SLA (Hrs)</label>
                                            <input
                                                type="number"
                                                required
                                                min="1"
                                                value={miniMasterFormData.resolutionSlaHours}
                                                onChange={(e) => setMiniMasterFormData({ ...miniMasterFormData, resolutionSlaHours: e.target.value })}
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold bg-white"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500 font-bold">Color Tag:</span>
                                        <input
                                            type="color"
                                            value={miniMasterFormData.color}
                                            onChange={(e) => setMiniMasterFormData({ ...miniMasterFormData, color: e.target.value })}
                                            className="h-8 w-16 p-0 rounded border border-slate-200 cursor-pointer bg-white"
                                        />
                                    </div>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={handleCreateMiniMaster}
                                disabled={!miniMasterFormData.name.trim()}
                                className="py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md disabled:bg-slate-300 disabled:shadow-none"
                            >
                                + Create & Select
                            </button>
                        </div>
                    </div>

                    {/* Existing Items List */}
                    <div className="space-y-2.5 max-h-[30vh] overflow-y-auto pr-1 custom-scrollbar">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Existing Entries</p>
                        {(() => {
                            let itemsList = [];
                            if (activeMiniMaster === 'source') itemsList = sources;
                            else if (activeMiniMaster === 'category') itemsList = categories;
                            else if (activeMiniMaster === 'type') itemsList = types;
                            else if (activeMiniMaster === 'priority') itemsList = priorities;
                            else if (activeMiniMaster === 'designation') itemsList = designations;

                            const filtered = miniMasterSearch.trim() 
                                ? itemsList.filter(item => item.name?.toLowerCase().includes(miniMasterSearch.toLowerCase()))
                                : itemsList;

                            if (filtered.length === 0) {
                                return <p className="text-xs text-slate-400 font-bold italic py-2">No matching items found.</p>;
                            }

                            return filtered.map(item => {
                                const isEditing = editingItemId === item._id;
                                return (
                                    <div key={item._id} className="p-3 border border-slate-100 hover:border-slate-200 rounded-2xl flex flex-col gap-2 transition-all bg-white shadow-sm">
                                        {isEditing ? (
                                            <form onSubmit={(e) => handleSaveEditMiniMaster(e, item._id)} className="space-y-3 w-full">
                                                <input
                                                    type="text"
                                                    required
                                                    value={editingItemFormData.name}
                                                    onChange={(e) => setEditingItemFormData({ ...editingItemFormData, name: e.target.value })}
                                                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                                                />
                                                {(activeMiniMaster === 'category' || activeMiniMaster === 'type' || activeMiniMaster === 'designation') && (
                                                    <input
                                                        type="text"
                                                        value={editingItemFormData.description}
                                                        onChange={(e) => setEditingItemFormData({ ...editingItemFormData, description: e.target.value })}
                                                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                                                        placeholder="Description"
                                                    />
                                                )}
                                                {activeMiniMaster === 'priority' && (
                                                    <>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <input
                                                                type="number"
                                                                required
                                                                min="1"
                                                                value={editingItemFormData.responseSlaHours}
                                                                onChange={(e) => setEditingItemFormData({ ...editingItemFormData, responseSlaHours: e.target.value })}
                                                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                                                                placeholder="Response SLA"
                                                            />
                                                            <input
                                                                type="number"
                                                                required
                                                                min="1"
                                                                value={editingItemFormData.resolutionSlaHours}
                                                                onChange={(e) => setEditingItemFormData({ ...editingItemFormData, resolutionSlaHours: e.target.value })}
                                                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                                                                placeholder="Resolution SLA"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-slate-500 font-bold">Color Tag:</span>
                                                            <input
                                                                type="color"
                                                                value={editingItemFormData.color}
                                                                onChange={(e) => setEditingItemFormData({ ...editingItemFormData, color: e.target.value })}
                                                                className="h-6 w-12 p-0 rounded border border-slate-200 cursor-pointer"
                                                            />
                                                        </div>
                                                    </>
                                                )}
                                                <div className="flex justify-end gap-2 text-[10px] font-black uppercase tracking-wider">
                                                    <button type="button" onClick={() => setEditingItemId(null)} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg">Cancel</button>
                                                    <button type="submit" className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg">Save</button>
                                                </div>
                                            </form>
                                        ) : (
                                            <div className="flex items-center justify-between gap-3 w-full">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-sm text-slate-900 truncate">{item.name}</p>
                                                        {activeMiniMaster === 'priority' && (
                                                            <span 
                                                                className="h-3 w-3 rounded-full border border-black/10 shadow-sm"
                                                                style={{ backgroundColor: item.color }}
                                                            />
                                                        )}
                                                    </div>
                                                    {activeMiniMaster === 'priority' && (
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Response: {item.responseSlaHours}h | Resolution: {item.resolutionSlaHours}h</p>
                                                    )}
                                                    {(activeMiniMaster === 'category' || activeMiniMaster === 'type' || activeMiniMaster === 'designation') && item.description && (
                                                        <p className="text-[11px] text-slate-400 font-semibold truncate mt-0.5">{item.description}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectMiniMasterItem(item)}
                                                        className="px-2.5 py-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                                    >
                                                        Select
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleStartEditMiniMaster(item)}
                                                        className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-all"
                                                        title="Edit"
                                                    >
                                                        <MdEdit size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteMiniMaster(item._id)}
                                                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                                                        title="Delete"
                                                    >
                                                        <MdDelete size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            </Modal>

            {/* Manual Registration - Full Page View */}
            {pageView === 'manual' && (
                <div className="space-y-6 animate-fade-in-up">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <button
                                type="button"
                                onClick={() => setPageView('list')}
                                className="text-xs font-black uppercase tracking-widest text-primary-600 hover:text-primary-700 mb-2 flex items-center gap-1 transition-all"
                            >
                                ← Back to Tickets
                            </button>
                            <h1 className="text-3xl font-black tracking-tight text-slate-900 font-outfit uppercase">
                                Manual Ticket Registration
                            </h1>
                            <p className="text-slate-500 font-semibold text-sm">Register a ticket manually with custom details.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setPageView('standard');
                                }}
                                className="px-6 py-3.5 border border-primary-600 text-primary-600 hover:bg-primary-50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                            >
                                Standard Register
                            </button>
                            <button
                                type="button"
                                onClick={() => setPageView('list')}
                                className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="manual-ticket-form"
                                disabled={isSavingManualTicket}
                                className="px-6 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-primary-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSavingManualTicket ? 'Registering...' : 'Raise Ticket'}
                            </button>
                        </div>
                    </div>
                    <div className="glass shadow-premium rounded-[2rem] p-6 md:p-8 bg-white border border-slate-100">
                <form id="manual-ticket-form" onSubmit={handleCreateManualTicket} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        
                        {/* Customer Name */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Name *</label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsManualCustomerText(!isManualCustomerText);
                                        setManualFormData(prev => ({ ...prev, customerId: '', customerName: '' }));
                                    }}
                                    className="text-[10px] font-black uppercase text-primary-600 hover:text-primary-700 tracking-wider flex items-center gap-0.5"
                                >
                                    {isManualCustomerText ? 'Select Existing' : '+ Enter Manually'}
                                </button>
                            </div>
                            {isManualCustomerText ? (
                                <input
                                    type="text"
                                    required
                                    placeholder="Enter customer name"
                                    value={manualFormData.customerName}
                                    onChange={(e) => setManualFormData({ ...manualFormData, customerName: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            ) : (
                                <SearchableSelect
                                    options={customers.map(c => ({
                                        value: c._id,
                                        label: c.companyName && c.companyName !== c.customerName 
                                            ? `${c.companyName} (${c.customerName})` 
                                            : c.companyName || c.customerName
                                    }))}
                                    value={manualFormData.customerId}
                                    onChange={handleManualCustomerChange}
                                    placeholder="Search & Select Customer..."
                                />
                            )}
                        </div>

                        {/* Pincode */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Pincode *</label>
                            <input
                                type="text"
                                required
                                placeholder="Enter Pincode"
                                value={manualFormData.pincode || ''}
                                onChange={(e) => setManualFormData({ ...manualFormData, pincode: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        {/* Invoice No */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Invoice No</label>
                            <input
                                type="text"
                                placeholder="Invoice Number"
                                value={manualFormData.invoiceNo}
                                onChange={(e) => setManualFormData({ ...manualFormData, invoiceNo: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        {/* Invoice Date */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Invoice Date</label>
                            <input
                                type="date"
                                value={manualFormData.invoiceDate}
                                onChange={(e) => setManualFormData({ ...manualFormData, invoiceDate: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        {/* Product Serial No. */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Product Serial No.</label>
                            <input
                                type="text"
                                placeholder="Serial Number"
                                value={manualFormData.serialNumber}
                                onChange={(e) => setManualFormData({ ...manualFormData, serialNumber: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        {/* Product Link (Search Product) */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Name</label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsManualProductText(!isManualProductText);
                                        setManualFormData(prev => ({ ...prev, productId: '', customProductName: '' }));
                                    }}
                                    className="text-[10px] font-black uppercase text-primary-600 hover:text-primary-700 tracking-wider flex items-center gap-0.5"
                                >
                                    {isManualProductText ? 'Select Product' : '+ Enter Manually'}
                                </button>
                            </div>
                            {isManualProductText ? (
                                <input
                                    type="text"
                                    placeholder="Enter custom product name"
                                    value={manualFormData.customProductName}
                                    onChange={(e) => setManualFormData({ ...manualFormData, customProductName: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            ) : (
                                <SearchableSelect
                                    options={products.map(p => ({
                                        value: p._id,
                                        label: `${p.productName} (${p.productCode})`
                                    }))}
                                    value={manualFormData.productId}
                                    onChange={(val) => setManualFormData({ ...manualFormData, productId: val })}
                                    placeholder="Search & Select Product..."
                                />
                            )}
                        </div>

                        {/* Ticket Source */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket Source</label>
                                <button 
                                    type="button" 
                                    onClick={() => handleOpenMiniMaster('source')}
                                    className="text-[10px] font-black uppercase text-primary-600 hover:text-primary-700 tracking-wider flex items-center gap-0.5"
                                >
                                    + Quick Add
                                </button>
                            </div>
                            <select
                                value={manualFormData.source}
                                onChange={(e) => setManualFormData({ ...manualFormData, source: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="">Select Source</option>
                                {sources.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
                            </select>
                        </div>

                        {/* Contact Person Name */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Contact Person Name</label>
                            <input
                                type="text"
                                value={manualFormData.contactName}
                                onChange={(e) => setManualFormData({ ...manualFormData, contactName: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        {/* Contact Phone */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Contact Phone</label>
                            <input
                                type="text"
                                value={manualFormData.contactPhone}
                                onChange={(e) => setManualFormData({ ...manualFormData, contactPhone: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        {/* Contact Email */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Contact Email</label>
                            <input
                                type="email"
                                value={manualFormData.contactEmail}
                                onChange={(e) => setManualFormData({ ...manualFormData, contactEmail: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        {/* Priority */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Priority</label>
                                <button 
                                    type="button" 
                                    onClick={() => handleOpenMiniMaster('priority')}
                                    className="text-[10px] font-black uppercase text-primary-600 hover:text-primary-700 tracking-wider flex items-center gap-0.5"
                                >
                                    + Quick Add
                                </button>
                            </div>
                            <select
                                value={manualFormData.priority}
                                onChange={(e) => setManualFormData({ ...manualFormData, priority: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="">Select Priority</option>
                                {priorities.map(p => <option key={p._id} value={p.name}>{p.name}</option>)}
                            </select>
                        </div>

                        {/* Category */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                                <button 
                                    type="button" 
                                    onClick={() => handleOpenMiniMaster('category')}
                                    className="text-[10px] font-black uppercase text-primary-600 hover:text-primary-700 tracking-wider flex items-center gap-0.5"
                                >
                                    + Quick Add
                                </button>
                            </div>
                            <select
                                value={manualFormData.category}
                                onChange={(e) => setManualFormData({ ...manualFormData, category: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="">Select Category</option>
                                {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>

                        {/* Ticket Type */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket Type</label>
                                <button 
                                    type="button" 
                                    onClick={() => handleOpenMiniMaster('type')}
                                    className="text-[10px] font-black uppercase text-primary-600 hover:text-primary-700 tracking-wider flex items-center gap-0.5"
                                >
                                    + Quick Add
                                </button>
                            </div>
                            <select
                                value={manualFormData.type}
                                onChange={(e) => setManualFormData({ ...manualFormData, type: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="">Select Type</option>
                                {types.map(t => <option key={t._id} value={t.name}>{t.name}</option>)}
                            </select>
                        </div>

                        {/* Subject */}
                        <div className="md:col-span-2 lg:col-span-3">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Subject *</label>
                            <input
                                type="text"
                                required
                                placeholder="Enter Ticket Subject"
                                value={manualFormData.issueTitle}
                                onChange={(e) => setManualFormData({ ...manualFormData, issueTitle: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        {/* Description */}
                        <div className="md:col-span-2 lg:col-span-3">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Description / Notes</label>
                            <textarea
                                placeholder="Write complete issue..."
                                value={manualFormData.description}
                                onChange={(e) => setManualFormData({ ...manualFormData, description: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold h-24 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                    </div>

                    {/* Image Upload Grid */}
                    <div className="border-t border-slate-100 pt-6 space-y-6">
                        {/* Device Images */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Device / Product Images</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {['front', 'back', 'left', 'right'].map((key) => {
                                    const hasImage = !!manualImages[key];
                                    const isUploading = uploadingImage[key];
                                    return (
                                        <div
                                            key={key}
                                            onClick={() => !isUploading && document.getElementById(`upload-${key}`).click()}
                                            className={`relative aspect-[4/3] sm:h-36 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
                                                hasImage 
                                                    ? 'border-teal-500 bg-teal-50/20' 
                                                    : 'border-slate-300 bg-slate-50/50 hover:border-primary-500 hover:bg-slate-50'
                                            }`}
                                        >
                                            <input
                                                type="file"
                                                id={`upload-${key}`}
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleImageUpload(key, e.target.files[0])}
                                            />
                                            {isUploading ? (
                                                <div className="flex flex-col items-center gap-1.5 text-slate-400">
                                                    <div className="w-6 h-6 border-2 border-slate-300 border-t-primary-600 rounded-full animate-spin"></div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider">Uploading...</span>
                                                </div>
                                            ) : hasImage ? (
                                                <div className="absolute inset-0 p-1.5 flex flex-col items-center justify-center">
                                                    <img
                                                        src={manualImages[key]}
                                                        alt={`${key} preview`}
                                                        className="w-full h-full object-cover rounded-xl"
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 rounded-xl flex items-center justify-center text-white transition-opacity">
                                                        <span className="text-[9px] font-black uppercase tracking-widest">Change Photo</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center p-3 text-slate-400 space-y-1">
                                                    <MdPhotoCamera size={24} className="mx-auto text-slate-400" />
                                                    <p className="text-xs font-bold text-slate-700 capitalize">{key} Image</p>
                                                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-tight">Click to upload</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Invoice Image */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Invoice Image</h4>
                            <div className="max-w-xs">
                                <div
                                    onClick={() => !uploadingImage.invoice && document.getElementById('upload-invoice').click()}
                                    className={`relative aspect-[4/3] h-36 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
                                        manualImages.invoice 
                                            ? 'border-teal-500 bg-teal-50/20' 
                                            : 'border-slate-300 bg-slate-50/50 hover:border-primary-500 hover:bg-slate-50'
                                    }`}
                                >
                                    <input
                                        type="file"
                                        id="upload-invoice"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => handleImageUpload('invoice', e.target.files[0])}
                                    />
                                    {uploadingImage.invoice ? (
                                        <div className="flex flex-col items-center gap-1.5 text-slate-400">
                                            <div className="w-6 h-6 border-2 border-slate-300 border-t-primary-600 rounded-full animate-spin"></div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Uploading...</span>
                                        </div>
                                    ) : manualImages.invoice ? (
                                        <div className="absolute inset-0 p-1.5 flex flex-col items-center justify-center">
                                            <img
                                                src={manualImages.invoice}
                                                alt="invoice preview"
                                                className="w-full h-full object-cover rounded-xl"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 rounded-xl flex items-center justify-center text-white transition-opacity">
                                                <span className="text-[9px] font-black uppercase tracking-widest">Change Photo</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center p-3 text-slate-400 space-y-1">
                                            <MdCloudUpload size={24} className="mx-auto text-slate-400" />
                                            <p className="text-xs font-bold text-slate-700">Upload Invoice</p>
                                            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-tight">Click to upload</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
                    </div>
                </div>
            )}

            {/* View Manual Ticket Modal */}
            <Modal
                isOpen={showManualViewModal}
                onClose={() => {
                    setShowManualViewModal(false);
                    setSelectedManualTicket(null);
                }}
                title={`Manual Ticket Details - ${selectedManualTicket?.ticketNo || ''}`}
                maxWidth="max-w-4xl"
                footer={
                    <div className="flex gap-2 justify-end w-full">
                        <button
                            type="button"
                            onClick={() => {
                                setShowManualViewModal(false);
                                if (selectedManualTicket) {
                                    navigate(`/csm/tickets/${selectedManualTicket._id}`);
                                }
                            }}
                            className="px-6 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95"
                        >
                            Open Timeline & Actions
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowManualViewModal(false);
                                setSelectedManualTicket(null);
                            }}
                            className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Close
                        </button>
                    </div>
                }
            >
                {selectedManualTicket && (() => {
                    const images = getManualImagesForTicket(selectedManualTicket);
                    const hasPhotos = images.front || images.back || images.left || images.right || images.invoice || images.other.length > 0;
                    
                    return (
                        <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {/* Customer Info */}
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Customer Details</span>
                                    <p className="text-sm font-bold text-slate-800">{selectedManualTicket.customerId?.companyName || selectedManualTicket.customerId?.customerName || 'N/A'}</p>
                                    <div className="text-xs space-y-1 text-slate-500 font-semibold">
                                        <p>Contact: {selectedManualTicket.contactName || 'N/A'}</p>
                                        <p>Phone: {selectedManualTicket.contactPhone || 'N/A'}</p>
                                        <p>Email: {selectedManualTicket.contactEmail || 'N/A'}</p>
                                    </div>
                                </div>

                                {/* Invoice Info */}
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Invoice Details</span>
                                    <p className="text-sm font-bold text-slate-800">
                                        No: {selectedManualTicket.manualInvoiceNo || 'N/A'}
                                    </p>
                                    {selectedManualTicket.manualInvoiceDate && (
                                        <p className="text-xs text-slate-500 font-semibold">
                                            Date: {new Date(selectedManualTicket.manualInvoiceDate).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>

                                {/* Product Info */}
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Product Details</span>
                                    <p className="text-sm font-bold text-slate-800">{selectedManualTicket.manualProductName || selectedManualTicket.productId?.productName || 'N/A'}</p>
                                    {selectedManualTicket.assetId?.serialNumber && (
                                        <p className="text-xs text-slate-500 font-semibold">
                                            Serial No: <span className="font-mono">{selectedManualTicket.assetId.serialNumber}</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Ticket Details */}
                            <div className="p-5 border border-slate-100 rounded-2xl space-y-3 bg-white">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: selectedManualTicket.priorityId?.color || '#64748b' }}>
                                        {selectedManualTicket.priorityId?.name || 'Medium'}
                                    </span>
                                    <span className="px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider bg-slate-50 text-slate-500 border-slate-200">
                                        {selectedManualTicket.status}
                                    </span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                                        Source: {selectedManualTicket.source}
                                    </span>
                                </div>
                                <h4 className="text-lg font-bold text-slate-900 border-b border-slate-50 pb-2">{selectedManualTicket.issueTitle}</h4>
                                <div className="text-sm text-slate-600 font-semibold whitespace-pre-wrap leading-relaxed">
                                    {(selectedManualTicket.description || '').split('--- Uploaded Images ---')[0].trim() || 'No description provided.'}
                                </div>
                            </div>

                            {/* Images Grid */}
                            {hasPhotos && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">Device & Invoice Images</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                                        {['front', 'back', 'left', 'right', 'invoice'].map((key) => {
                                            const url = images[key];
                                            if (!url) return null;
                                            return (
                                                <div key={key} className="space-y-1.5">
                                                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest capitalize">{key} view</span>
                                                    <a href={url} target="_blank" rel="noopener noreferrer" className="block relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 hover:scale-105 transition-transform active:scale-95 group shadow-sm bg-slate-50">
                                                        <img src={url} alt={`${key} view`} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-black uppercase tracking-widest transition-opacity">
                                                            View Full Size
                                                        </div>
                                                    </a>
                                                </div>
                                            );
                                        })}
                                        {images.other.map((url, index) => (
                                            <div key={index} className="space-y-1.5">
                                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Attachment {index + 1}</span>
                                                <a href={url} target="_blank" rel="noopener noreferrer" className="block relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 hover:scale-105 transition-transform active:scale-95 group shadow-sm bg-slate-50">
                                                    <img src={url} alt={`attachment-${index}`} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-black uppercase tracking-widest transition-opacity">
                                                        View Full Size
                                                    </div>
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </Modal>

            {/* Import Summary Modal */}
            <Modal
                isOpen={showImportResultModal}
                onClose={() => setShowImportResultModal(false)}
                title="Import Tickets Summary"
                maxWidth="max-w-md"
                footer={
                    <div className="flex gap-2 w-full justify-end">
                        {importResult?.errors?.length > 0 && (
                            <button
                                type="button"
                                onClick={downloadErrorReport}
                                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                Download Error Report
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowImportResultModal(false)}
                            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            Close
                        </button>
                    </div>
                }
            >
                {importResult && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 text-center">
                            <div className="p-3 bg-teal-50 border border-teal-100 rounded-2xl">
                                <span className="block text-[10px] font-black uppercase tracking-widest text-teal-600">Imported</span>
                                <span className="text-xl font-black text-teal-800">{importResult.imported}</span>
                            </div>
                            <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl">
                                <span className="block text-[10px] font-black uppercase tracking-widest text-rose-500">Failed</span>
                                <span className="text-xl font-black text-rose-800">{importResult.failed}</span>
                            </div>
                        </div>

                        {importResult.errors?.length > 0 && (
                            <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl space-y-2">
                                <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold">
                                    <MdWarning size={16} />
                                    <span>Some rows failed to import:</span>
                                </div>
                                <div className="max-h-40 overflow-y-auto text-[11px] font-semibold text-slate-600 space-y-1 custom-scrollbar">
                                    {importResult.errors.slice(0, 10).map((err, idx) => (
                                        <p key={idx} className="leading-relaxed">• {err}</p>
                                    ))}
                                    {importResult.errors.length > 10 && (
                                        <p className="text-slate-400 italic">And {importResult.errors.length - 10} more errors...</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default CSMTickets;
