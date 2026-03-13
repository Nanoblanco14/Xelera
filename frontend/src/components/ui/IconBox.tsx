"use client";

export default function IconBox({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-center w-[34px] h-[34px] rounded-[10px] bg-white/5 border-[0.5px] border-white/[0.07] text-zinc-400 shrink-0">
            {children}
        </div>
    );
}
