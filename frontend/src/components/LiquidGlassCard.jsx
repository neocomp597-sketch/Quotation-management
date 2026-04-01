import React from 'react';
import { MdAttachMoney } from 'react-icons/md';

const LiquidGlassCard = ({ 
    title = "TOTAL VALUE", 
    value = "₹ 14,50,000", 
    icon = <MdAttachMoney size={24} /> 
}) => {
    return (
        <div className="relative group perspective-[1000px]">
             {/* 
                This outer div provides a 3D perspective to elements inside 
                The main card blends dark glassy translucency with multi-layered shadows
                for that thick, 3D "liquid glass" refraction effect.
             */}
            <div 
                className="
                    relative 
                    flex items-center gap-4
                    p-4 pr-8
                    rounded-2xl 
                    bg-[#1E2336]/60 
                    backdrop-blur-2xl
                    border border-white/10 border-b-white/5 border-r-white/5
                    shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.15)]
                    transform transition-all duration-500 will-change-transform
                    group-hover:-translate-y-2 group-hover:rotate-x-2 group-hover:rotate-y-[-2deg]
                    group-hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.2)]
                    overflow-hidden
                "
            >
                {/* 
                   Liquid glare/shine overlay for realism 
                */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                {/* 
                   Vibrant Green Icon Box 
                   Using a glowing emerald color matching your image perfectly
                */}
                <div 
                    className="
                        relative z-10
                        flex items-center justify-center 
                        w-12 h-12 
                        rounded-xl 
                        bg-emerald-500
                        text-white
                        shadow-[0_0_20px_rgba(16,185,129,0.4),inset_0_2px_4px_rgba(255,255,255,0.3)]
                        border border-emerald-400/50
                        transform transition-transform duration-500
                        group-hover:scale-110 group-hover:rotate-3
                    "
                >
                    {icon}
                </div>

                {/* 
                   Text Content 
                */}
                <div className="relative z-10 flex flex-col justify-center">
                    <span className="text-[10px] font-black tracking-[0.15em] text-slate-400 uppercase drop-shadow-md">
                        {title}
                    </span>
                    <span className="text-xl font-black text-white drop-shadow-lg tracking-tight mt-0.5">
                        {value}
                    </span>
                </div>
            </div>
            
            {/* 
               Base shadow cast by the 3D object to firmly ground it 
            */}
            <div className="absolute -bottom-4 left-6 right-6 h-4 bg-black/40 blur-xl rounded-[100%] transition-opacity duration-500 opacity-50 group-hover:opacity-20 pointer-events-none" />
        </div>
    );
};

export default LiquidGlassCard;
