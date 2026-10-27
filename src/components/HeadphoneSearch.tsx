import React, { useState, useRef, useEffect } from "react";
import { HEADPHONE_PROFILES } from "../data/headphones";
import { Headphones, Search, Check, ChevronDown, X } from "lucide-react";

interface HeadphoneSearchProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

export const HeadphoneSearch: React.FC<HeadphoneSearchProps> = ({ selectedId, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedProfile =
    HEADPHONE_PROFILES.find((h) => h.id === selectedId) || HEADPHONE_PROFILES[0];

  const filtered = HEADPHONE_PROFILES.filter((hp) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      hp.name.toLowerCase().includes(q) ||
      hp.brand.toLowerCase().includes(q) ||
      hp.type.toLowerCase().includes(q)
    );
  });

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 rounded-lg bg-tactical-900 hover:bg-tactical-800 border border-tactical-600 hover:border-tactical-accent/60 text-xs font-mono text-left flex items-center justify-between transition-all group shadow-sm"
      >
        <div className="flex items-center space-x-2.5 truncate">
          <Headphones className="w-4 h-4 text-tactical-accent shrink-0 group-hover:scale-105 transition-transform" />
          <div className="truncate">
            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">
              {selectedProfile.brand}
            </span>
            <span className="text-slate-100 font-semibold truncate block">
              {selectedProfile.name}
            </span>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-tactical-accent" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-tactical-900 border border-tactical-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-72 animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Search Box */}
          <div className="p-2 border-b border-tactical-700 bg-tactical-850 flex items-center space-x-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por marca o modelo (HyperX, DT 770...)"
              className="w-full bg-transparent text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filtered List */}
          <div className="overflow-y-auto divide-y divide-tactical-800 p-1 flex-1">
            {filtered.length > 0 ? (
              filtered.map((hp) => {
                const isSelected = hp.id === selectedId;
                return (
                  <button
                    key={hp.id}
                    type="button"
                    onClick={() => {
                      onSelect(hp.id);
                      setIsOpen(false);
                      setQuery("");
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-left text-xs font-mono flex items-center justify-between transition-colors ${
                      isSelected
                        ? "bg-tactical-accent/15 text-tactical-accent font-bold"
                        : "hover:bg-tactical-800 text-slate-300 hover:text-slate-100"
                    }`}
                  >
                    <div className="truncate mr-2">
                      <span className="text-[10px] text-slate-400 block uppercase">
                        {hp.brand} • {hp.type}
                      </span>
                      <span className="truncate block">{hp.name}</span>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-tactical-accent shrink-0 ml-1" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs font-mono text-slate-500">
                No se encontraron auriculares para "{query}".
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
