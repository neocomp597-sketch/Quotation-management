import React, { useState } from 'react';
import { productService } from '../services/api';
import { toast } from 'react-toastify';
import { MdQuestionAnswer, MdNavigateNext, MdNavigateBefore, MdLightbulbCircle, MdCheckCircle } from 'react-icons/md';

const GuidedSelling = () => {
    const [step, setStep] = useState(1);
    const [answers, setAnswers] = useState({
        projectType: '',
        budget: 'Under 10 Lakh',
        duration: 'Short Term',
        machineType: ''
    });
    const [recommendations, setRecommendations] = useState([]);
    const [searching, setSearching] = useState(false);

    const handleSelectOption = (field, value) => {
        setAnswers(prev => ({ ...prev, [field]: value }));
    };

    const handleNext = () => {
        setStep(prev => prev + 1);
    };

    const handleBack = () => {
        setStep(prev => Math.max(1, prev - 1));
        setRecommendations([]);
    };

    const handleSubmitQuestions = async () => {
        setSearching(true);
        setStep(5);
        try {
            const res = await productService.getAll({});
            const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
            
            // Recommender filter algorithm based on simulated weights
            let budgetMax = 1000000;
            if (answers.budget === '10 - 50 Lakh') budgetMax = 5000000;
            if (answers.budget === 'Above 50 Lakh') budgetMax = 99999999;

            const matches = list.filter(item => {
                const price = item.basePrice || 0;
                const matchesBudget = price <= budgetMax;
                const matchesType = !answers.machineType || 
                    item.productName.toLowerCase().includes(answers.machineType.toLowerCase()) || 
                    item.productCode.toLowerCase().includes(answers.machineType.toLowerCase());
                return matchesBudget && matchesType;
            });

            setRecommendations(matches.slice(0, 4));
        } catch (err) {
            toast.error("Recommender system failed to fetch catalog items");
        } finally {
            setSearching(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6 py-6">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">CPQ Guided Selling Assistant</h1>
                <p className="text-slate-500 font-medium text-sm">Answer a few project parameters and find the perfect equipment and pricing plan.</p>
            </div>

            {/* Stepper HUD */}
            <div className="flex justify-between items-center bg-slate-50 rounded-2xl p-4 border border-slate-100">
                {[
                    { label: 'Project Type', step: 1 },
                    { label: 'Budget', step: 2 },
                    { label: 'Duration', step: 3 },
                    { label: 'Specifications', step: 4 },
                    { label: 'Recommendations', step: 5 }
                ].map(s => (
                    <div key={s.step} className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition-all ${step >= s.step ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {s.step}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-wider hidden md:inline ${step === s.step ? 'text-primary-600' : 'text-slate-400'}`}>
                            {s.label}
                        </span>
                    </div>
                ))}
            </div>

            {/* Steps Panels */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-8 min-h-[300px] flex flex-col justify-between">
                {step === 1 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                            <MdQuestionAnswer className="text-primary-600" size={24} />
                            What is the type of your project development?
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { val: 'Construction', desc: 'Civil engineering, building foundations, high-rise construction' },
                                { val: 'Mining', desc: 'Resource excavation, heavy materials drilling, rock breaking' },
                                { val: 'Highway', desc: 'Road paving, highway grading, concrete leveling' },
                                { val: 'Rental & AMC', desc: 'Temporary equipment rental or recurring maintenance agreements' }
                            ].map(o => (
                                <button
                                    key={o.val}
                                    onClick={() => handleSelectOption('projectType', o.val)}
                                    className={`p-5 text-left rounded-2xl border-2 transition-all hover:border-primary-500 hover:shadow-lg ${answers.projectType === o.val ? 'border-primary-600 bg-primary-50/30' : 'border-slate-100'}`}
                                >
                                    <div className="font-extrabold text-slate-900">{o.val}</div>
                                    <div className="text-xs text-slate-400 mt-1">{o.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                            <MdQuestionAnswer className="text-primary-600" size={24} />
                            What is your estimated equipment allocation budget?
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {['Under 10 Lakh', '10 - 50 Lakh', 'Above 50 Lakh'].map(b => (
                                <button
                                    key={b}
                                    onClick={() => handleSelectOption('budget', b)}
                                    className={`p-6 text-center rounded-2xl border-2 transition-all ${answers.budget === b ? 'border-primary-600 bg-primary-50/30' : 'border-slate-100'}`}
                                >
                                    <div className="font-extrabold text-slate-900 text-sm">{b}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                            <MdQuestionAnswer className="text-primary-600" size={24} />
                            What is the expected lease or project duration?
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { val: 'Short Term', desc: '1 - 6 Months lease durations' },
                                { val: 'Long Term', desc: 'Annual agreements or multi-year projects' }
                            ].map(d => (
                                <button
                                    key={d.val}
                                    onClick={() => handleSelectOption('duration', d.val)}
                                    className={`p-6 text-left rounded-2xl border-2 transition-all ${answers.duration === d.val ? 'border-primary-600 bg-primary-50/30' : 'border-slate-100'}`}
                                >
                                    <div className="font-extrabold text-slate-900">{d.val}</div>
                                    <div className="text-xs text-slate-400 mt-1">{d.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                            <MdQuestionAnswer className="text-primary-600" size={24} />
                            Do you have a specific equipment classification in mind?
                        </h2>
                        <div>
                            <input
                                type="text"
                                placeholder="e.g. Excavator, Rig, Piling, License..."
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-900 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
                                value={answers.machineType}
                                onChange={e => handleSelectOption('machineType', e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {step === 5 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                            <MdLightbulbCircle className="text-amber-500" size={26} />
                            Guided Recommendations
                        </h2>
                        {searching ? (
                            <div className="text-center py-8 font-bold text-slate-400 animate-pulse">Running recommendation engine algorithms...</div>
                        ) : recommendations.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 font-bold">No catalog offerings matched all criteria. Try expanding budget limits.</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {recommendations.map(p => (
                                    <div key={p._id} className="p-5 rounded-2xl border border-slate-100 bg-slate-50 flex items-center gap-4">
                                        <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center font-black">
                                            <MdCheckCircle size={22} />
                                        </div>
                                        <div>
                                            <h4 className="font-extrabold text-slate-900 text-sm leading-tight">{p.productName}</h4>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{p.productCode} • {p.catalogType}</p>
                                            <p className="text-sm font-extrabold text-primary-600 mt-2">₹ {Number(p.basePrice).toLocaleString()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Footer Buttons */}
                <div className="flex justify-between items-center pt-6 border-t border-slate-50 mt-8">
                    {step > 1 ? (
                        <button
                            onClick={handleBack}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-500 text-xs uppercase tracking-wider hover:bg-slate-50"
                        >
                            <MdNavigateBefore size={18} />
                            Back
                        </button>
                    ) : <div />}

                    {step < 4 ? (
                        <button
                            onClick={handleNext}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-primary-600/20"
                        >
                            Next
                            <MdNavigateNext size={18} />
                        </button>
                    ) : step === 4 ? (
                        <button
                            onClick={handleSubmitQuestions}
                            className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/20"
                        >
                            Generate Offer
                        </button>
                    ) : (
                        <button
                            onClick={handleBack}
                            className="px-6 py-2.5 rounded-xl bg-primary-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-primary-600/20"
                        >
                            Reset Wizard
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GuidedSelling;
