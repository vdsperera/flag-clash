const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'flag-clash.html');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add ethers.js
if (!content.includes('ethers.umd.min.js')) {
    content = content.replace('</head>', '  <script src="https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.4/ethers.umd.min.js"></script>\n</head>');
}

// 2. Modify "Top Up" modal into "Get Test USDT (Faucet)"
content = content.replace('id="topupBtn">Top Up</button>', 'id="topupBtn">Get Test USDT</button>');
content = content.replace('<h3>Top Up Central Treasury Balance</h3>', '<h3>Mint Test USDT (Faucet)</h3>');
content = content.replace('id="topupSub">Top-ups are transferred to Central Treasury Vault <b id="topupVaultAddr" style="font-family:monospace; color:var(--gold);">0x71C3...8888</b>.</div>', 'id="topupSub">Mint up to 1000 Mock USDT for testing.</div>');
content = content.replace(/<div class="amount-grid" id="amountGrid">[\s\S]*?<\/div>/, ''); // Remove preset amounts
content = content.replace(/<div class="custom-amt-wrap">[\s\S]*?<\/div>/, `
    <div class="custom-amt-wrap">
      <label for="customAmountInput">USDT Amount:</label>
      <input type="number" id="customAmountInput" class="custom-amt-input" value="1000" min="1" max="1000" step="1">
    </div>
`);
content = content.replace('Confirm Top Up (+5.00 USDT)', 'Mint Test USDT');

// 3. Replace the entire script content
const newScript = `
(function(){
  const THRESHOLD = 10;           
  const PLATFORM_FEE_PCT = 5;  
  
  // REPLACE THESE AFTER DEPLOYMENT
  const USDT_ADDRESS = "0x0000000000000000000000000000000000000000";
  const FLAG_CLASH_ADDRESS = "0x0000000000000000000000000000000000000000";

  const usdtAbi = [
    "function balanceOf(address owner) view returns (uint256)",
    "function faucet(uint256 amount)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
  ];

  const flagClashAbi = [
    "function backTeam(uint8 team, uint256 amount)",
    "function declareWinner(uint8 team)",
    "function claimPrize()",
    "function getMatchState() view returns (uint8 state, uint8 winner, uint256 sIndia, uint256 sSL, uint256 poolIndia, uint256 poolSL, bool claimed)",
    "function getUserBacking(address user) view returns (uint256 indiaBacking, uint256 slBacking)",
    "function POINT_COST() view returns (uint256)",
    "event TeamBacked(address indexed user, uint8 team, uint256 amount, uint256 pointsScored)",
    "event WinnerDeclared(uint8 winningTeam, uint256 totalPool, uint256 netPrizePool)",
    "event PrizeClaimed(address indexed user, uint256 amount)"
  ];

  let provider;
  let signer;
  let usdtContract;
  let flagClashContract;

  let score = { india: 0, sl: 0 };
  let selected = null;
  let wallet = 0.00;
  let connectedAccount = null;
  let transactions = [];
  
  let userIndiaSpend = 0.00;
  let userSLSpend = 0.00;
  let matchWinner = null; 
  let payoutClaimed = false;

  let isPendingTx = false;
  let pointCost = 0.1; // fetched from contract

  const audioCtx = (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;
  function playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.05) {
    if (!audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch(e){}
  }

  const el = {
    countIndia: document.getElementById('countIndia'),
    countSL: document.getElementById('countSL'),
    sideIndia: document.getElementById('sideIndia'),
    sideSL: document.getElementById('sideSL'),
    flagIndia: document.getElementById('flagIndia'),
    flagSL: document.getElementById('flagSL'),
    seam: document.getElementById('seam'),
    diffReadout: document.getElementById('diffReadout'),
    thresholdLabel: document.getElementById('thresholdLabel'),
    resetBtn: document.getElementById('resetBtn'),
    resetWalletBtn: document.getElementById('resetWalletBtn'),
    declareIndiaBtn: document.getElementById('declareIndiaBtn'),
    declareSLBtn: document.getElementById('declareSLBtn'),
    disconnectBtn: document.getElementById('disconnectBtn'),
    walletBalance: document.getElementById('walletBalance'),
    walletLabel: document.getElementById('walletLabel'),
    connectedAddr: document.getElementById('connectedAddr'),
    connectWalletBtn: document.getElementById('connectWalletBtn'),
    topupBtn: document.getElementById('topupBtn'),
    historyBtn: document.getElementById('historyBtn'),
    treasuryAddrTag: document.getElementById('treasuryAddrTag'),

    poolTotalVal: document.getElementById('poolTotalVal'),
    poolBarIndia: document.getElementById('poolBarIndia'),
    poolBarSL: document.getElementById('poolBarSL'),
    indiaMultiplier: document.getElementById('indiaMultiplier'),
    slMultiplier: document.getElementById('slMultiplier'),
    indiaUserPayout: document.getElementById('indiaUserPayout'),
    slUserPayout: document.getElementById('slUserPayout'),
    winnerBanner: document.getElementById('winnerBanner'),
    winnerTitle: document.getElementById('winnerTitle'),
    winnerDesc: document.getElementById('winnerDesc'),
    claimPrizeBtn: document.getElementById('claimPrizeBtn'),

    connectModalBackdrop: document.getElementById('connectModalBackdrop'),
    connectModalClose: document.getElementById('connectModalClose'),
    metamaskStatus: document.getElementById('metamaskStatus'),
    metamaskBadge: document.getElementById('metamaskBadge'),

    topupModalBackdrop: document.getElementById('topupModalBackdrop'),
    topupModalClose: document.getElementById('topupModalClose'),
    customAmountInput: document.getElementById('customAmountInput'),
    txStatusBox: document.getElementById('txStatusBox'),
    confirmTopupBtn: document.getElementById('confirmTopupBtn'),

    historyModalBackdrop: document.getElementById('historyModalBackdrop'),
    historyModalClose: document.getElementById('historyModalClose'),
    historyList: document.getElementById('historyList'),
  };

  el.thresholdLabel.textContent = THRESHOLD;
  el.treasuryAddrTag.textContent = truncateAddr(FLAG_CLASH_ADDRESS);

  const spokesGroup = document.getElementById('spokesIndia');
  for (let i = 0; i < 24; i++){
    const angle = (i * 15) * Math.PI / 180;
    const x2 = 450 + 78 * Math.cos(angle);
    const y2 = 300 + 78 * Math.sin(angle);
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1', 450);
    line.setAttribute('y1', 300);
    line.setAttribute('x2', x2.toFixed(1));
    line.setAttribute('y2', y2.toFixed(1));
    spokesGroup.appendChild(line);
  }

  function truncateAddr(addr){
    if(!addr) return 'Not Connected';
    return addr.substring(0,6) + '...' + addr.substring(addr.length - 4);
  }

  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

  async function fetchStateFromChain() {
      if (!flagClashContract || !connectedAccount) return;
      try {
          const state = await flagClashContract.getMatchState();
          // state is: state, winner, sIndia, sSL, poolIndia, poolSL, claimed
          matchWinner = state[0] === 1n ? (state[1] === 0n ? 'india' : 'sl') : null;
          score.india = Number(state[2]);
          score.sl = Number(state[3]);
          payoutClaimed = state[6];

          const backing = await flagClashContract.getUserBacking(connectedAccount);
          userIndiaSpend = Number(ethers.formatUnits(backing[0], 6));
          userSLSpend = Number(ethers.formatUnits(backing[1], 6));

          const bal = await usdtContract.balanceOf(connectedAccount);
          wallet = Number(ethers.formatUnits(bal, 6));

          render();
      } catch (err) {
          console.error("Error fetching state:", err);
      }
  }

  function render(){
    el.countIndia.textContent = score.india;
    el.countSL.textContent = score.sl;

    el.sideIndia.classList.toggle('selected', selected === 'india');
    el.sideSL.classList.toggle('selected', selected === 'sl');
    el.flagIndia.classList.toggle('is-selected', selected === 'india');
    el.flagSL.classList.toggle('is-selected', selected === 'sl');

    const diff = score.india - score.sl;
    el.sideIndia.classList.toggle('leading', diff > 0);
    el.sideSL.classList.toggle('leading', diff < 0);

    const diffClamped = clamp(diff, -THRESHOLD, THRESHOLD);
    const opacityIndia = 0.5 + (diffClamped / THRESHOLD) * 0.5;
    const opacitySL = 1 - opacityIndia;

    el.flagIndia.style.opacity = opacityIndia.toFixed(3);
    el.flagSL.style.opacity = opacitySL.toFixed(3);

    if (diff >= 0){
      el.flagIndia.style.zIndex = 2;
      el.flagSL.style.zIndex = 1;
    } else {
      el.flagSL.style.zIndex = 2;
      el.flagIndia.style.zIndex = 1;
    }

    const pull = clamp(diff / THRESHOLD, -1, 1);
    el.seam.style.left = (50 - pull * 42) + '%';

    if (matchWinner){
      const winnerName = matchWinner === 'india' ? 'India' : 'Sri Lanka';
      el.diffReadout.textContent = \`\${winnerName} WINS THE CLASH! Prize Pool Ready for Claim.\`;
    } else if (selected){
      el.diffReadout.textContent = \`Backing \${selected === 'india' ? 'India' : 'Sri Lanka'} \u2014 lead: \${diff > 0 ? '+' : ''}\${diff} of \${THRESHOLD}\`;
    } else {
      el.diffReadout.textContent = 'Pick a side to begin';
    }

    const totalIndiaPool = score.india * pointCost;
    const totalSLPool = score.sl * pointCost;
    const totalPool = totalIndiaPool + totalSLPool;
    const netPrizePool = totalPool * (1 - (PLATFORM_FEE_PCT/100));

    el.poolTotalVal.textContent = totalPool.toFixed(2) + ' USDT';
    
    let indiaRatio = totalPool > 0 ? (totalIndiaPool / totalPool) * 100 : 50;
    let slRatio = totalPool > 0 ? (totalSLPool / totalPool) * 100 : 50;
    el.poolBarIndia.style.width = indiaRatio.toFixed(1) + '%';
    el.poolBarSL.style.width = slRatio.toFixed(1) + '%';

    const indiaMult = totalIndiaPool > 0 ? (netPrizePool / totalIndiaPool) : 1.90;
    const slMult = totalSLPool > 0 ? (netPrizePool / totalSLPool) : 1.90;
    el.indiaMultiplier.textContent = indiaMult.toFixed(2) + 'x Win Odds';
    el.slMultiplier.textContent = slMult.toFixed(2) + 'x Win Odds';

    const userEstIndiaPayout = userIndiaSpend > 0 ? (userIndiaSpend * (totalIndiaPool > 0 ? netPrizePool / totalIndiaPool : 1)) : 0;
    const userEstSLPayout = userSLSpend > 0 ? (userSLSpend * (totalSLPool > 0 ? netPrizePool / totalSLPool : 1)) : 0;
    el.indiaUserPayout.textContent = \`Your Est: \${userEstIndiaPayout.toFixed(2)} USDT\`;
    el.slUserPayout.textContent = \`Your Est: \${userEstSLPayout.toFixed(2)} USDT\`;

    if (matchWinner) {
      el.winnerBanner.style.display = 'block';
      const winTeamName = matchWinner === 'india' ? 'India 🇮🇳' : 'Sri Lanka 🇱🇰';
      el.winnerTitle.textContent = \`🏆 \${winTeamName} Wins The Clash!\`;
      
      const userWinningSpend = matchWinner === 'india' ? userIndiaSpend : userSLSpend;
      const totalWinningPool = matchWinner === 'india' ? totalIndiaPool : totalSLPool;
      const userSharePayout = totalWinningPool > 0 ? (userWinningSpend / totalWinningPool) * netPrizePool : 0;

      if (payoutClaimed) {
        el.winnerDesc.textContent = \`✓ You have claimed your share of the prize pool (\${userSharePayout.toFixed(2)} USDT)!\`;
        el.claimPrizeBtn.disabled = true;
        el.claimPrizeBtn.textContent = 'Payout Claimed ✓';
        el.claimPrizeBtn.style.background = 'rgba(255,255,255,0.15)';
      } else if (userWinningSpend > 0) {
        el.winnerDesc.textContent = \`Congratulations! You backed the winning team with \${userWinningSpend.toFixed(2)} USDT. Your Prize Payout: +\${userSharePayout.toFixed(2)} USDT!\`;
        el.claimPrizeBtn.disabled = false;
        el.claimPrizeBtn.textContent = \`Claim Payout (+\${userSharePayout.toFixed(2)} USDT)\`;
        el.claimPrizeBtn.style.background = '';
      } else {
        el.winnerDesc.textContent = \`You did not back \${winTeamName} in this match. Better luck next battle!\`;
        el.claimPrizeBtn.disabled = true;
        el.claimPrizeBtn.textContent = 'No Winning Backing';
        el.claimPrizeBtn.style.background = 'rgba(255,255,255,0.15)';
      }
    } else {
      el.winnerBanner.style.display = 'none';
    }

    el.walletBalance.textContent = wallet.toFixed(2) + ' USDT';
    el.walletBalance.classList.toggle('low', wallet < pointCost);

    if (connectedAccount) {
      el.walletLabel.textContent = 'MetaMask';
      el.connectedAddr.textContent = truncateAddr(connectedAccount);
      el.connectWalletBtn.textContent = 'Connected';
      el.connectWalletBtn.style.background = 'rgba(16,185,129,0.2)';
      el.connectWalletBtn.style.border = '1px solid rgba(16,185,129,0.4)';
      el.connectWalletBtn.style.color = '#10b981';
      el.disconnectBtn.style.display = 'inline-block';
    } else {
      el.walletLabel.textContent = 'Not Connected';
      el.connectedAddr.textContent = 'Click to Connect';
      el.connectWalletBtn.textContent = 'Connect Wallet';
      el.connectWalletBtn.style.background = '';
      el.connectWalletBtn.style.border = '';
      el.connectWalletBtn.style.color = '';
      el.disconnectBtn.style.display = 'none';
    }

    if (window.ethereum) {
      el.metamaskStatus.textContent = 'Detected & ready';
      el.metamaskBadge.textContent = 'Available';
      el.metamaskBadge.style.background = 'rgba(16,185,129,0.15)';
      el.metamaskBadge.style.color = 'var(--accent-green)';
    }
  }

  function selectSide(side){
    selected = side;
    playTone(440, 'sine', 0.08, 0.04);
    render();
  }

  function flashInsufficientFunds(){
    playTone(200, 'sawtooth', 0.2, 0.08);
    el.diffReadout.textContent = \`Need \${pointCost.toFixed(2)} USDT per click \u2014 mint from faucet\`;
    el.topupBtn.classList.remove('pulse');
    void el.topupBtn.offsetWidth;
    el.topupBtn.classList.add('pulse');
  }

  async function scorePoint(){
    if (!selected) return;
    if (!connectedAccount) {
        openConnectModal();
        return;
    }
    if (wallet < pointCost){
      flashInsufficientFunds();
      return;
    }
    if (matchWinner) return;

    try {
        const amountWei = ethers.parseUnits(pointCost.toString(), 6);
        const teamId = selected === 'india' ? 0 : 1;

        // Check allowance
        const allowance = await usdtContract.allowance(connectedAccount, FLAG_CLASH_ADDRESS);
        if (allowance < amountWei) {
            el.diffReadout.textContent = "Approving USDT for backing...";
            const txApprove = await usdtContract.approve(FLAG_CLASH_ADDRESS, ethers.MaxUint256);
            await txApprove.wait();
        }

        el.diffReadout.textContent = "Backing team on-chain...";
        const tx = await flagClashContract.backTeam(teamId, amountWei);
        await tx.wait();

        // Let the event listener update the score, but we can do optimisitic UI
        playTone(600 + (score[selected] * 15), 'sine', 0.06, 0.03);
        const activeFlag = selected === 'india' ? el.flagIndia : el.flagSL;
        activeFlag.classList.remove('click-bounce');
        void activeFlag.offsetWidth;
        activeFlag.classList.add('click-bounce');

        transactions.unshift({
          id: tx.hash,
          type: 'spend',
          amount: pointCost,
          side: selected === 'india' ? 'India' : 'Sri Lanka',
          timestamp: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})
        });
        if (transactions.length > 50) transactions.pop();

        await fetchStateFromChain();
    } catch (err) {
        console.error(err);
        el.diffReadout.textContent = "Transaction failed or rejected.";
    }
  }

  async function claimPayout(){
    if (!matchWinner || payoutClaimed || !connectedAccount) return;
    
    try {
        el.claimPrizeBtn.disabled = true;
        el.claimPrizeBtn.textContent = "Claiming...";
        const tx = await flagClashContract.claimPrize();
        await tx.wait();

        playTone(1000, 'triangle', 0.4, 0.1);
        
        // Let state fetch handle the UI update
        await fetchStateFromChain();
        
        transactions.unshift({
          id: tx.hash,
          type: 'payout',
          amount: 0, // Not easily available without parsing event
          team: matchWinner === 'india' ? 'India' : 'Sri Lanka',
          timestamp: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
        });
    } catch (err) {
        console.error(err);
        el.claimPrizeBtn.disabled = false;
        el.claimPrizeBtn.textContent = "Claim Failed";
    }
  }

  el.treasuryAddrTag.addEventListener('click', (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(FLAG_CLASH_ADDRESS);
  });

  el.connectedAddr.addEventListener('click', (e) => {
    e.stopPropagation();
    if (connectedAccount) {
      navigator.clipboard.writeText(connectedAccount);
    } else {
      openConnectModal();
    }
  });

  function openConnectModal(){
    el.connectModalBackdrop.classList.add('open');
  }
  function closeConnectModal(){
    el.connectModalBackdrop.classList.remove('open');
  }

  async function connectWallet(providerType){
    if (providerType === 'metamask' && window.ethereum) {
      try {
        provider = new ethers.BrowserProvider(window.ethereum);
        
        // Ensure Base Sepolia
        const network = await provider.getNetwork();
        if (network.chainId !== 84532n) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x14a34' }],
                });
            } catch (switchError) {
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: '0x14a34',
                            chainName: 'Base Sepolia',
                            rpcUrls: ['https://sepolia.base.org'],
                            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                            blockExplorerUrls: ['https://sepolia.basescan.org/']
                        }],
                    });
                }
            }
            provider = new ethers.BrowserProvider(window.ethereum);
        }

        signer = await provider.getSigner();
        connectedAccount = await signer.getAddress();
        
        usdtContract = new ethers.Contract(USDT_ADDRESS, usdtAbi, signer);
        flagClashContract = new ethers.Contract(FLAG_CLASH_ADDRESS, flagClashAbi, signer);
        
        try {
            const pc = await flagClashContract.POINT_COST();
            pointCost = Number(ethers.formatUnits(pc, 6));
        } catch(e){}

        await fetchStateFromChain();

        // Listen for events
        flagClashContract.on("TeamBacked", (user, team, amount, pointsScored) => {
            fetchStateFromChain();
        });
        flagClashContract.on("WinnerDeclared", (winningTeam) => {
            fetchStateFromChain();
            playTone(900, 'sine', 0.4, 0.1);
        });

      } catch(err) {
        console.error('Connection error:', err);
      }
    }
    closeConnectModal();
    render();
  }

  function disconnectWallet(){
    connectedAccount = null;
    provider = null;
    signer = null;
    if (flagClashContract) flagClashContract.removeAllListeners();
    flagClashContract = null;
    usdtContract = null;
    render();
  }

  function openTopupModal(){
    isPendingTx = false;
    el.customAmountInput.value = '1000';
    setTxStatus(\`Mint up to 1000 Test USDT.\`);
    el.confirmTopupBtn.disabled = false;
    el.topupModalClose.disabled = false;
    el.topupModalBackdrop.classList.add('open');
  }

  function closeTopupModal(){
    if (isPendingTx) return;
    el.topupModalBackdrop.classList.remove('open');
  }

  function setTxStatus(msg, isSpinner = false, txHash = null){
    if (isSpinner) {
      el.txStatusBox.innerHTML = \`<div class="tx-spinner"></div><div>\${msg}</div>\`;
    } else if (txHash) {
      el.txStatusBox.innerHTML = \`<div>\${msg}</div><a class="tx-hash-link" href="https://sepolia.basescan.org/tx/\${txHash}" target="_blank" rel="noopener">Tx Hash: \${txHash.substring(0,18)}...</a>\`;
    } else {
      el.txStatusBox.innerHTML = \`<div>\${msg}</div>\`;
    }
  }

  async function processTopup(){
    const customVal = parseFloat(el.customAmountInput.value);
    const amt = (!isNaN(customVal) && customVal > 0) ? customVal : 1000;
    if (amt <= 0 || isPendingTx) return;

    if (!connectedAccount) {
      openConnectModal();
      return;
    }

    isPendingTx = true;
    el.confirmTopupBtn.disabled = true;
    el.topupModalClose.disabled = true;

    setTxStatus(\`Awaiting approval to mint \${amt} USDT...\`, true);

    try {
        const tx = await usdtContract.faucet(ethers.parseUnits(amt.toString(), 6));
        setTxStatus(\`Minting on-chain...\`, true, tx.hash);
        await tx.wait();
        
        setTxStatus(\`✓ USDT Minted Successfully!\`, false, tx.hash);
        playTone(880, 'triangle', 0.25, 0.08);

        transactions.unshift({
          id: tx.hash,
          type: 'topup',
          amount: amt,
          txHash: tx.hash,
          timestamp: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
        });
        if (transactions.length > 50) transactions.pop();

        await fetchStateFromChain();
        
        setTimeout(() => {
          isPendingTx = false;
          closeTopupModal();
        }, 1200);

    } catch(err) {
        console.error(err);
        setTxStatus(\`Minting failed.\`);
        isPendingTx = false;
        el.confirmTopupBtn.disabled = false;
        el.topupModalClose.disabled = false;
    }
  }

  function openHistoryModal(){
    renderHistory();
    el.historyModalBackdrop.classList.add('open');
  }
  function closeHistoryModal(){
    el.historyModalBackdrop.classList.remove('open');
  }

  function renderHistory(){
    if (transactions.length === 0) {
      el.historyList.innerHTML = '<div style="text-align:center; color:var(--ink-2); font-size:12px; padding:20px;">No transactions recorded yet.</div>';
      return;
    }

    el.historyList.innerHTML = transactions.map(item => {
      if (item.type === 'topup') {
        return \`
          <div class="history-item topup">
            <div class="history-meta">
              <span class="history-title">Minted Test USDT</span>
              <span class="history-time">\${item.timestamp} &middot; <a href="https://sepolia.basescan.org/tx/\${item.txHash}" target="_blank" class="tx-hash-link">Tx: \${item.txHash.substring(0,10)}...</a></span>
            </div>
            <span class="amt">+\${item.amount.toFixed(2)} USDT</span>
          </div>
        \`;
      } else if (item.type === 'payout') {
        return \`
          <div class="history-item payout">
            <div class="history-meta">
              <span class="history-title">🏆 Prize Claimed (\${item.team})</span>
              <span class="history-time">\${item.timestamp}</span>
            </div>
            <span class="amt">Claimed</span>
          </div>
        \`;
      } else {
        return \`
          <div class="history-item spend">
            <div class="history-meta">
              <span class="history-title">Backed \${item.side} (1 Point)</span>
              <span class="history-time">\${item.timestamp}</span>
            </div>
            <span class="amt">-\${item.amount.toFixed(2)} USDT</span>
          </div>
        \`;
      }
    }).join('');
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Numpad1' || e.key === '1'){ selectSide('india'); }
    else if (e.code === 'Numpad2' || e.key === '2'){ selectSide('sl'); }
  });

  el.flagIndia.addEventListener('click', (e) => { e.stopPropagation(); selectSide('india'); });
  el.flagSL.addEventListener('click', (e) => { e.stopPropagation(); selectSide('sl'); });
  el.sideIndia.addEventListener('click', (e) => { e.stopPropagation(); selectSide('india'); });
  el.sideSL.addEventListener('click', (e) => { e.stopPropagation(); selectSide('sl'); });

  document.getElementById('clickZone').addEventListener('click', scorePoint);
  document.getElementById('topNav').addEventListener('click', (e) => e.stopPropagation());
  document.getElementById('poolDashboard').addEventListener('click', (e) => e.stopPropagation());
  document.getElementById('winnerBanner').addEventListener('click', (e) => e.stopPropagation());

  el.claimPrizeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    claimPayout();
  });

  el.resetBtn.style.display = 'none';
  el.resetWalletBtn.style.display = 'none';
  
  el.declareIndiaBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if(flagClashContract) await flagClashContract.declareWinner(0);
  });
  el.declareSLBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if(flagClashContract) await flagClashContract.declareWinner(1);
  });
  el.disconnectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    disconnectWallet();
  });

  el.connectWalletBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openConnectModal();
  });
  el.connectModalClose.addEventListener('click', (e) => { e.stopPropagation(); closeConnectModal(); });
  el.connectModalBackdrop.addEventListener('click', (e) => { if (e.target === el.connectModalBackdrop) closeConnectModal(); });

  document.querySelectorAll('.wallet-opt').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      connectWallet(opt.dataset.wallet);
    });
  });

  el.topupBtn.addEventListener('click', (e) => { e.stopPropagation(); openTopupModal(); });
  el.topupModalClose.addEventListener('click', (e) => { e.stopPropagation(); closeTopupModal(); });
  el.topupModalBackdrop.addEventListener('click', (e) => { if (e.target === el.topupModalBackdrop) closeTopupModal(); });

  el.confirmTopupBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    processTopup();
  });

  el.historyBtn.addEventListener('click', (e) => { e.stopPropagation(); openHistoryModal(); });
  el.historyModalClose.addEventListener('click', (e) => { e.stopPropagation(); closeHistoryModal(); });
  el.historyModalBackdrop.addEventListener('click', (e) => { if (e.target === el.historyModalBackdrop) closeHistoryModal(); });

  render();
})();
`;

content = content.replace(/<script>[\s\S]*?<\/script>/, '<script>\n' + newScript + '\n</script>');

fs.writeFileSync(filePath, content);
console.log('Successfully updated flag-clash.html with ethers.js integration.');
