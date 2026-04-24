import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronRight } from 'lucide-react';

const SearchableMemberSelect = ({ members, value, onChange, placeholder = "Search member...", extraOptions = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredMembers = members
    .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()) || m.id.toString().includes(search))
    .slice(0, 50); // limit for UX performance

  const selectedMember = members.find((m) => m.id.toString() === value?.toString());
  const selectedExtraOption = extraOptions.find((opt) => opt.value === value);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div 
        className="w-full min-h-12 rounded-xl bg-slate-50 border border-slate-200 px-4 py-2 flex items-center cursor-text focus-within:ring-2 focus-within:ring-coop-green/20 focus-within:bg-white transition-all overflow-hidden"
        onClick={() => setIsOpen(true)}
      >
        <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
        {isOpen ? (
          <input
            autoFocus
            type="text"
            className="w-full bg-transparent outline-none text-sm font-bold placeholder:text-slate-400 placeholder:font-medium"
            placeholder={placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        ) : (
          <div className="flex-1 truncate">
            {selectedExtraOption ? (
              <span className={`font-bold text-sm ${selectedExtraOption.className || 'text-slate-900'}`}>
                {selectedExtraOption.label}
              </span>
            ) : selectedMember ? (
              <span className="font-bold text-slate-900 text-sm">
                {selectedMember.name} 
                <span className="text-slate-400 text-xs font-normal ml-2">
                  UID: {selectedMember.id.toString().padStart(6, '0')}
                </span>
              </span>
            ) : (
              <span className="text-slate-400 font-medium text-sm">{placeholder}</span>
            )}
          </div>
        )}
        <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute top-14 left-0 w-full bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-72 overflow-y-auto z-50 py-2"
          >
            {extraOptions.length > 0 && search === "" && (
              <div className="px-2 pb-2 mb-2 border-b border-slate-100">
                {extraOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors ${opt.className}`}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch("");
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
            
            {filteredMembers.length > 0 ? (
               filteredMembers.map((m) => (
                 <button
                   key={m.id}
                   type="button"
                   className="w-full text-left px-6 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50/50 last:border-0 flex justify-between items-center group"
                   onClick={() => {
                     onChange(m.id);
                     setIsOpen(false);
                     setSearch("");
                   }}
                 >
                   <div>
                     <p className="text-sm font-bold text-slate-900 group-hover:text-coop-green transition-colors">{m.name}</p>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                       UID: {m.id.toString().padStart(6, '0')} • {(m.address || '').split(',')[0]}
                     </p>
                   </div>
                   <div className="text-right">
                      <p className={`text-xs font-black ${m.balance >= 1000 ? 'text-coop-green' : 'text-rose-500'}`}>
                        ₱{m.balance?.toLocaleString()}
                      </p>
                   </div>
                 </button>
               ))
            ) : (
               <div className="px-6 py-8 text-center">
                 <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No members found</p>
               </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchableMemberSelect;