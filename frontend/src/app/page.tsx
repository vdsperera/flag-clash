'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';

// ABI for the FlagClash contract
const FLAG_CLASH_ABI = [
  "function currentMatchId() view returns (uint256)",
  "function getMatchState(uint256 matchId) view returns (uint8 state, uint8 winner, uint256 sIndia, uint256 sSL, uint256 poolIndia, uint256 poolSL, bool claimed)",
  "function backTeam(uint256 matchId, uint8 team, uint256 amount) external",
];

// Address would come from deployment
const FLAG_CLASH_ADDRESS = "0x0000000000000000000000000000000000000000";

export default function Home() {
  const { isConnected } = useAccount();
  const { writeContract, isPending } = useWriteContract();

  const { data: currentMatchId } = useReadContract({
    address: FLAG_CLASH_ADDRESS,
    abi: FLAG_CLASH_ABI,
    functionName: 'currentMatchId',
  });

  const { data: matchState } = useReadContract({
    address: FLAG_CLASH_ADDRESS,
    abi: FLAG_CLASH_ABI,
    functionName: 'getMatchState',
    args: currentMatchId ? [currentMatchId] : undefined,
    query: {
      enabled: !!currentMatchId,
    }
  });

  const handleBackTeam = (team: number) => {
    if (!currentMatchId) return;
    writeContract({
      address: FLAG_CLASH_ADDRESS,
      abi: FLAG_CLASH_ABI,
      functionName: 'backTeam',
      args: [currentMatchId, team, parseUnits("0.1", 6)],
    });
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl flex justify-between items-center mb-12">
        <h1 className="text-3xl font-bold">Flag Clash</h1>
        <ConnectButton />
      </div>

      {!isConnected ? (
        <div className="text-xl text-gray-400">Please connect your wallet to play.</div>
      ) : (
        <div className="w-full max-w-2xl bg-gray-800 rounded-xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold mb-2">Match #{currentMatchId?.toString()}</h2>
            <div className="flex justify-around items-center mt-6">
              <div className="flex flex-col items-center">
                <span className="text-4xl mb-4">🇮🇳</span>
                <span className="text-xl font-bold">India</span>
                <span className="text-gray-400 mt-2">Score: {matchState?.[2]?.toString() || "0"}</span>
                <button 
                  onClick={() => handleBackTeam(0)}
                  disabled={isPending}
                  className="mt-4 px-6 py-2 bg-orange-600 hover:bg-orange-700 rounded-full font-semibold transition-colors disabled:opacity-50"
                >
                  Back India (0.1 USDT)
                </button>
              </div>

              <div className="text-3xl font-black text-gray-600">VS</div>

              <div className="flex flex-col items-center">
                <span className="text-4xl mb-4">🇱🇰</span>
                <span className="text-xl font-bold">Sri Lanka</span>
                <span className="text-gray-400 mt-2">Score: {matchState?.[3]?.toString() || "0"}</span>
                <button 
                  onClick={() => handleBackTeam(1)}
                  disabled={isPending}
                  className="mt-4 px-6 py-2 bg-red-700 hover:bg-red-800 rounded-full font-semibold transition-colors disabled:opacity-50"
                >
                  Back Sri Lanka (0.1 USDT)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
