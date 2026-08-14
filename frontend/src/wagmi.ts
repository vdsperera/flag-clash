import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  baseSepolia,
  hardhat,
} from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Flag Clash',
  projectId: 'YOUR_PROJECT_ID', // Replaced with actual one in production
  chains: [
    baseSepolia,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true' ? [hardhat] : []),
  ],
  ssr: true,
});
