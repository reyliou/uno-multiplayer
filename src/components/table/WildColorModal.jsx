// 檔案位置：src/components/table/WildColorModal.jsx
import React from 'react';
import { TurnTimerCircle } from './TurnTimerCircle';

export function WildColorModal({
  isOpen = false,
  turnStartTime = null,
  turnDuration = 6,
  myColorCounts = { red: 0, yellow: 0, green: 0, blue: 0 },
  onSelectColor
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-5 rounded-3xl bg-[#0a1c12]/95 border-2 border-amber-400 shadow-2xl backdrop-blur-md flex flex-col items-center gap-3">
      <div className="text-sm font-black text-white flex items-center justify-between w-full">
        <span>請指定變色牌顏色 (限時 6 秒)</span>
        <TurnTimerCircle turnStartTime={turnStartTime} duration={turnDuration || 6} isLocal />
      </div>

      <div className="text-[11px] text-amber-200/90 text-center px-2">
        超時未選將自動以你手中最多顏色的牌出發！
      </div>

      <div className="grid grid-cols-2 gap-2.5 w-64">
        <button
          type="button"
          onClick={() => onSelectColor('red')}
          className="py-2.5 px-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-xs shadow-lg transition active:scale-95 flex flex-col items-center border border-red-300/40 cursor-pointer"
        >
          <span>紅色 RED</span>
          <span className="text-[10px] opacity-80 mt-0.5">手中 {myColorCounts.red} 張</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectColor('yellow')}
          className="py-2.5 px-3 rounded-2xl bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs shadow-lg transition active:scale-95 flex flex-col items-center border border-yellow-300/40 cursor-pointer"
        >
          <span>黃色 YELLOW</span>
          <span className="text-[10px] opacity-80 mt-0.5">手中 {myColorCounts.yellow} 張</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectColor('green')}
          className="py-2.5 px-3 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-black text-xs shadow-lg transition active:scale-95 flex flex-col items-center border border-green-300/40 cursor-pointer"
        >
          <span>綠色 GREEN</span>
          <span className="text-[10px] opacity-80 mt-0.5">手中 {myColorCounts.green} 張</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectColor('blue')}
          className="py-2.5 px-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-lg transition active:scale-95 flex flex-col items-center border border-blue-300/40 cursor-pointer"
        >
          <span>藍色 BLUE</span>
          <span className="text-[10px] opacity-80 mt-0.5">手中 {myColorCounts.blue} 張</span>
        </button>
      </div>
    </div>
  );
}
