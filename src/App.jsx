import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CARDS } from './data/cards';

const SUPABASE_URL = "https://weciyecpxrpsmosibwla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlY2l5ZWNweHJwc21vc2lid2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMjk0MDEsImV4cCI6MjA5NTkwNTQwMX0.Ga0YNTWXKL5YwBbCAdZEYUUOoe-wdsLH9O5fS7A_DMA";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function App() {
  const [cardDatabase, setCardDatabase] = useState(CARDS);
  const [screen, setScreen] = useState('MAIN'); 
  const [userId, setUserId] = useState('');
  const [roomCode, setRoomCode] = useState('');

  // --- 덱 빌더 상태 ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeader, setSelectedLeader] = useState(null);
  const [deckCards, setDeckCards] = useState([]); 
  const [isReady, setIsReady] = useState(false);
  const [isOpponentReady, setIsOpponentReady] = useState(false); 
  const [isOpponentConnected, setIsOpponentConnected] = useState(false); 

  const [savedDecks, setSavedDecks] = useState([]);
  const [newDeckName, setNewDeckName] = useState('');

  const [ipFilters, setIpFilters] = useState({
    '니케': true, '브더2': true, '에픽세븐': true, '이리': true
  });

  // --- 내 플레이매트 상태 ---
  const [leaderLevel, setLeaderLevel] = useState(1); 
  const [trashDeck, setTrashDeck] = useState([]);    
  const [isLeaderFlipped, setIsLeaderFlipped] = useState(false);
  const [unitZoneSlots, setUnitZoneSlots] = useState([null, null, null]); 
  const [skillZoneCards, setSkillZoneCards] = useState([]); 
  const [damageStack, setDamageStack] = useState([]);
  const [myFullDeckList, setMyFullDeckList] = useState([]); 
  const [topOfDeckCard, setTopOfDeckCard] = useState(null); 

  // --- 상대방 원격 매트 동기화 상태 ---
  const [oppUserId, setOppUserId] = useState('상대방 입장 대기 중...');
  const [oppLeaderLevel, setOppLeaderLevel] = useState(1);
  const [oppIsLeaderFlipped, setOppIsLeaderFlipped] = useState(false);
  const [oppLeaderCard, setOppLeaderCard] = useState(null);
  const [oppUnitZoneSlots, setOppUnitZoneSlots] = useState([null, null, null]); 
  const [oppDamageStack, setOppDamageStack] = useState([]);
  const [oppSkillZoneCards, setOppSkillZoneCards] = useState([]);
  const [oppTrashCount, setOppTrashCount] = useState(0);
  const [oppDeckCount, setOppDeckCount] = useState(40);

  const [isDeckSelectModalOpen, setIsDeckSelectModalOpen] = useState(false); 
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [inspectingUnitIndex, setInspectingUnitIndex] = useState(null); 
  
  // 상대방 카드 서치 돋보기용 상태
  const [magnifiedCard, setMagnifiedCard] = useState(null);

  const [draggingCard, setDraggingCard] = useState(null);
  const [draggedFrom, setDraggedFrom] = useState(null); 

  const channelRef = useRef(null);

  useEffect(() => {
    const localDecks = localStorage.getItem('NIVEL_SAVED_DECKS');
    if (localDecks) setSavedDecks(JSON.parse(localDecks));
  }, []);

  // 1. 닉네임 구속형 클라우드 덱 로더
  const fetchCloudDecks = async (targetUser) => {
    try {
      const { data, error } = await supabase
        .from('saved_decks')
        .select('*')
        .eq('user_id', targetUser);

      if (error) throw error;
      if (data) {
        const formattedDecks = data.map(d => ({
          id: d.id,
          name: d.deck_name,
          leader: d.deck_data.leader,
          cards: d.deck_data.cards
        }));
        setSavedDecks(formattedDecks);
      }
    } catch (err) {
      console.log("클라우드 장부 불러오기 대기 중:", err.message);
    }
  };

  // [수정사항 1 반영]: 튕기던 오류 소탕하고 확실하게 수파베이스에 밀어넣는 덱 저장 함수
  const handleSaveDeck = async () => {
    if (deckCards.length !== 40) return alert('덱은 반드시 40장이 채워져야 저장할 수 있습니다!');
    if (!selectedLeader) return alert('리더 카드를 선택해야 덱을 저장할 수 있습니다!');
    
    const nameToSave = newDeckName.trim() || `${selectedLeader.name} 덱`;
    
    try {
      // 서버 장부 컬럼 구조에 정확하게 매칭하고 고유키 충돌 방지 가드 처리
      const { error } = await supabase
        .from('saved_decks')
        .insert([
          {
            user_id: userId,
            deck_name: nameToSave,
            deck_data: { leader: selectedLeader, cards: deckCards }
          }
        ]);

      if (error) throw error;

      alert(`📥 [${nameToSave}]이 클라우드 서버에 안전하게 등록되었습니다! 이제 어디서든 [${userId}] 닉네임만 치면 즉시 로드됩니다.`);
      setNewDeckName('');
      fetchCloudDecks(userId); 
    } catch (err) {
      alert(`서버 저장 실패: ${err.message}`);
    }
  };

  const handleDeleteDeck = async (deckId, e) => {
    e.stopPropagation();
    if (!window.confirm('이 덱을 클라우드 서버에서 영구 삭제하시겠습니까?')) return;
    
    try {
      const { error } = await supabase
        .from('saved_decks')
        .delete()
        .eq('id', deckId);

      if (error) throw error;
      fetchCloudDecks(userId); 
    } catch (err) {
      console.error(err.message);
    }
  };

  const connectToCloudServer = (code) => {
    const channelName = `nivelarena-room-${code}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } }
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'JOIN' }, (payload) => {
        setIsOpponentConnected(true);
        setOppUserId(payload.payload.userId);
        alert(`🎮 플레이어 [${payload.payload.userId}]님이 입장했습니다! 클라우드 전장이 가동됩니다.`);
        
        channel.send({
          type: 'broadcast',
          event: 'JOIN_REPLY',
          payload: { userId: userId }
        });
      })
      .on('broadcast', { event: 'JOIN_REPLY' }, (payload) => {
        setIsOpponentConnected(true);
        setOppUserId(payload.payload.userId);
      })
      .on('broadcast', { event: 'SYNC_MAT' }, (payload) => {
        const oppState = payload.payload;
        if (oppState.isReadyState !== undefined) setIsOpponentReady(oppState.isReadyState);
        if (oppState.leaderLevel !== undefined) setOppLeaderLevel(oppState.leaderLevel);
        if (oppState.isLeaderFlipped !== undefined) setOppIsLeaderFlipped(oppState.isLeaderFlipped);
        if (oppState.selectedLeader !== undefined) setOppLeaderCard(oppState.selectedLeader);
        if (oppState.skillZoneCards !== undefined) setOppSkillZoneCards(oppState.skillZoneCards);
        if (oppState.damageStack !== undefined) setOppDamageStack(oppState.damageStack);
        if (oppState.trashCount !== undefined) setOppTrashCount(oppState.trashCount);
        if (oppState.deckCount !== undefined) setOppDeckCount(oppState.deckCount);
        
        if (oppState.unitZoneSlots !== undefined) {
          // 거울형 레인 시스템: 상대가 보낸 배열을 내 시점에서 마주보게 우측 반전 처리!
          setOppUnitZoneSlots([...oppState.unitZoneSlots].reverse()); 
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'JOIN',
            payload: { userId: userId }
          });
        }
      });
  };

  const broadcastMyState = (customPayload = {}) => {
    if (channelRef.current) {
      const basePayload = {
        isReadyState: isReady,
        leaderLevel: leaderLevel,
        isLeaderFlipped: isLeaderFlipped,
        selectedLeader: selectedLeader,
        unitZoneSlots: unitZoneSlots,
        damageStack: damageStack,
        skillZoneCards: skillZoneCards,
        trashCount: trashDeck.length,
        deckCount: myFullDeckList.length
      };

      channelRef.current.send({
        type: 'broadcast',
        event: 'SYNC_MAT',
        payload: { ...basePayload, ...customPayload }
      });
    }
  };

  useEffect(() => {
    if (screen === 'GAME') {
      broadcastMyState();
    }
  }, [leaderLevel, isLeaderFlipped, unitZoneSlots, damageStack, skillZoneCards, trashDeck, myFullDeckList, screen]);

  const handleCodeChange = (value) => {
    const onlyNums = value.replace(/[^0-9]/g, '');
    if (onlyNums.length <= 3) setRoomCode(onlyNums);
  };

  const handleEnterDeckScreen = () => {
    if (!userId.trim()) return alert('아이디를 입력해주세요!');
    if (roomCode.length !== 3) return alert('방 코드는 3자리 숫자여야 합니다.');
    setScreen('DECK'); 
    setIsReady(false);
    setIsOpponentReady(false);
    
    fetchCloudDecks(userId); 
    connectToCloudServer(roomCode); 
  };

  const handleToggleReady = () => {
    if (!selectedLeader) return alert('리더 카드가 결정되어야 준비 완료 상태로 변경할 수 있습니다!');
    if (deckCards.length !== 40) return alert(`메인 덱은 반드시 정확히 40장이어야 합니다! (현재: ${deckCards.length}장)`);
    if (!isOpponentConnected) return alert('아직 상대방이 이 방 주파수에 접속하지 않았습니다. 기다려주세요!');

    const nextReady = !isReady;
    setIsReady(nextReady);
    broadcastMyState({ isReadyState: nextReady });
  };

  useEffect(() => {
    if (screen === 'DECK' && isReady && isOpponentReady) {
      setMyFullDeckList([...deckCards]); 
      setTopOfDeckCard(null); 
      setLeaderLevel(1);
      setDamageStack([]); 
      setIsLeaderFlipped(false); 
      setUnitZoneSlots([null, null, null]);
      setSkillZoneCards([]);
      setTrashDeck([]);
      setScreen('GAME');
    }
  }, [isReady, isOpponentReady, screen]);

  const handleExitGame = () => {
    if (!window.confirm('게임을 종료하고 처음 화면으로 돌아가시겠습니까?')) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    setScreen('MAIN');
    setUserId(''); setRoomCode('');
    setSelectedLeader(null); setDeckCards([]); setSearchTerm('');
    setIsReady(false); setIsOpponentReady(false); setMagnifiedCard(null);
  };

  const handleLoadDeck = (deck) => {
    if (window.confirm(`[${deck.name}]을 불러오시겠습니까?`)) {
      setSelectedLeader(deck.leader);
      setDeckCards(deck.cards);
      setIsReady(false);
      setIsOpponentReady(false);
    }
  };

  const handleIpFilterChange = (ipName) => {
    setIpFilters(prev => ({ ...prev, [ipName]: !prev[ipName] }));
  };

  const onBuilderDragStart = (card) => {
    setDraggingCard(card);
  };

  // [수정사항 2 반영]: 동일 카드 이름이 3장 존재할 경우 빌딩을 완전 차단하는 규칙 엔진 가드
  const onMainDeckDrop = (e) => {
    e.preventDefault();
    if (!draggingCard) return;
    if (draggingCard.type === 'Leader') return alert('리더 카드는 아래 [리더 드롭 존]으로 장착해 주세요!');
    if (deckCards.length >= 40) return alert('🚨 메인 덱은 이미 최대 수량인 40장입니다!');
    
    // 내 덱에 들어있는 카드 중 같은 이름의 개수 연산
    const sameCardCount = deckCards.filter(c => c.name === draggingCard.name).length;
    if (sameCardCount >= 3) {
      return alert(`🚨 규칙 위반: 니벨아레나 TCG 룰 상 동일한 카드는 덱에 최대 3장까지만 투입할 수 있습니다! ([${draggingCard.name}] 현재 3장 존재)`);
    }

    setDeckCards([...deckCards, { ...draggingCard, instanceId: `card-${Date.now()}-${Math.random()}` }]);
    setDraggingCard(null);
  };

  const handleRemoveCardFromDeck = (instanceId) => {
    setDeckCards(prev => prev.filter(c => c.instanceId !== instanceId));
  };

  const onLeaderZoneDrop = (e) => {
    e.preventDefault();
    if (!draggingCard) return;
    if (draggingCard.type !== 'Leader') return alert('여기에는 리더 카드만 장착할 수 있습니다!');
    setSelectedLeader(draggingCard);
    setDraggingCard(null);
  };

  const onDeckDragStart = () => {
    if (!topOfDeckCard) return;
    setDraggingCard(topOfDeckCard);
    setDraggedFrom('DECK_ZONE');
  };

  const consumeCardFromDeck = (instanceId) => {
    setMyFullDeckList(prevList => prevList.filter(c => c.instanceId !== instanceId));
    setTopOfDeckCard(null); 
  };

  const onUnitSlotDrop = (e, slotIndex) => {
    e.preventDefault();
    if (!draggingCard) return;
    const currentSlotCard = unitZoneSlots[slotIndex];

    if (draggedFrom === 'DECK_ZONE' && draggingCard.type === 'Item') {
      if (!currentSlotCard) return alert('아이템은 유닛이 배치된 슬롯에만 장착할 수 있습니다!');
      const updatedSlots = [...unitZoneSlots];
      updatedSlots[slotIndex] = { ...currentSlotCard, items: [...(currentSlotCard.items || []), draggingCard] };
      setUnitZoneSlots(updatedSlots);
      consumeCardFromDeck(draggingCard.instanceId); 
      setDraggingCard(null);
      return;
    }

    if (draggingCard.type === 'Unit') {
      const updatedSlots = [...unitZoneSlots];
      if (currentSlotCard) {
        setTrashDeck([...trashDeck, currentSlotCard, ...(currentSlotCard.items || [])]);
      }
      updatedSlots[slotIndex] = { ...draggingCard, items: [] };
      setUnitZoneSlots(updatedSlots);
      if (draggedFrom === 'DECK_ZONE') consumeCardFromDeck(draggingCard.instanceId); 
    }
    setDraggingCard(null);
  };

  const onDamageStackDrop = (e) => {
    e.preventDefault();
    if (!draggingCard) return;
    setDamageStack([...damageStack, draggingCard]);
    if (draggedFrom === 'DECK_ZONE') consumeCardFromDeck(draggingCard.instanceId); 
    setDraggingCard(null);
  };

  const onSkillZoneDrop = (e) => {
    e.preventDefault();
    if (!draggingCard || draggingCard.type !== 'Skill') return alert('스킬 존에는 스킬 카드만 놓을 수 있습니다!');
    setSkillZoneCards([...skillZoneCards, draggingCard]);
    if (draggedFrom === 'DECK_ZONE') consumeCardFromDeck(draggingCard.instanceId); 
    setDraggingCard(null);
  };

  const handlePopDamageStack = (e) => {
    e.stopPropagation(); 
    if (damageStack.length === 0) return;
    const updatedStack = [...damageStack];
    const poppedCard = updatedStack.pop(); 
    setDamageStack(updatedStack);
    setTrashDeck([...trashDeck, poppedCard]);
  };

  const handleKillUnit = (slotIndex) => {
    const target = unitZoneSlots[slotIndex];
    if (!target) return;
    setTrashDeck([...trashDeck, target, ...(target.items || [])]);
    const updated = [...unitZoneSlots];
    updated[slotIndex] = null;
    setUnitZoneSlots(updated);
  };

  // 1. 처음 화면
  if (screen === 'MAIN') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 select-none">
        <h1 className="text-3xl font-black mb-8 tracking-wider text-zinc-400">NIVELARENA CLOUD VTT</h1>
        <div className="w-full max-w-xl border-4 border-zinc-800 p-10 space-y-8 bg-zinc-900 rounded-3xl shadow-2xl">
          <div className="flex flex-col space-y-3 items-center">
            <label className="text-lg font-black text-zinc-400 tracking-wide">PLAYER ID</label>
            <input type="text" placeholder="닉네임을 입력하세요" value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full max-w-md px-6 py-4 text-lg border-2 border-zinc-700 bg-zinc-950 text-white rounded-xl text-center font-bold focus:outline-none focus:border-zinc-500 shadow-inner" />
          </div>
          
          <div className="flex flex-col space-y-4 max-w-md mx-auto pt-2 border-t border-zinc-800">
            <div className="flex flex-col space-y-2">
              <span className="text-base font-black text-zinc-400 text-center">서버 코드</span>
              <input type="text" placeholder="코드 (3자리 숫자)" value={roomCode} onChange={(e) => handleCodeChange(e.target.value)} className="w-full px-4 py-3.5 border-2 border-zinc-700 bg-zinc-950 text-white rounded-xl text-center font-black text-xl focus:outline-none tracking-widest" />
            </div>
            <button onClick={handleEnterDeckScreen} className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 border-2 border-zinc-600 text-white font-black text-lg rounded-xl tracking-wide transition-all active:scale-[0.98] shadow-md mt-2">
              🚀 전장 채널 접속하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. 내 덱 준비하는 화면
  if (screen === 'DECK') {
    const currentSearchText = searchTerm || '';
    const displayCards = cardDatabase.filter(c => {
      if (!c || !c.name) return false;
      const matchesSearch = c.name.toLowerCase().includes(currentSearchText.toLowerCase());
      const cardIp = c.ip || '니케';
      const matchesIpFilter = ipFilters[cardIp] === true;
      return matchesSearch && matchesIpFilter;
    });

    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 flex flex-col items-center select-none">
        <h1 className="text-2xl font-black mb-6 tracking-wide text-zinc-500">DECK BUILDING STEP ({roomCode}번 채널 대기방)</h1>
        <div className="w-full max-w-7xl grid grid-cols-12 gap-6">
          <div className="col-span-7 border-4 border-zinc-800 p-5 flex flex-col h-[780px] bg-zinc-900 rounded-3xl shadow-xl">
            <label className="font-black text-zinc-300 text-sm mb-3">🃏 카드 도감 (원하는 카드를 우측 드래그앤드롭):</label>
            <div className="flex gap-4 mb-3 p-3 bg-zinc-950 text-zinc-300 rounded-xl font-black text-xs items-center shadow-inner border border-zinc-800">
              <span className="text-zinc-400">🔍 IP 필터링 :</span>
              {['니케', '브더2', '에픽세븐', '이리'].map(ipName => (
                <label key={ipName} className="flex items-center gap-2 cursor-pointer select-none hover:text-white transition-colors">
                  <input type="checkbox" checked={ipFilters[ipName]} onChange={() => handleIpFilterChange(ipName)} className="w-4 h-4 cursor-pointer accent-zinc-500 rounded" />
                  {ipName}
                </label>
              ))}
            </div>
            <input type="text" placeholder="카드 이름으로 서치..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-3.5 bg-zinc-950 border-2 border-zinc-800 text-white mb-4 rounded-xl font-bold focus:outline-none" />
            <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-3 gap-4">
              {displayCards.map((card, idx) => (
                <div key={card.name + idx} draggable onDragStart={() => onBuilderDragStart(card)} className="border-2 border-zinc-800 rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing hover:border-zinc-500 hover:scale-[1.02] transition-all bg-zinc-950 flex flex-col justify-between h-[340px] shadow-lg">
                  <div className="w-full h-[72%] bg-zinc-900 flex items-center justify-center p-2 overflow-hidden relative border-b border-zinc-800/60">
                    {card.type === 'Leader' ? (
                      <div className="w-full h-full max-w-[210px] aspect-[4/3] rounded-lg border border-zinc-800 relative overflow-hidden bg-black flex items-center justify-center">
                        <div className="absolute inset-0 bg-no-repeat" style={{ backgroundImage: `url(${card.imgUrl})`, backgroundPosition: 'center top', backgroundSize: '100% 200%' }}></div>
                      </div>
                    ) : (
                      <img src={card.imgUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-md" alt={card.name} />
                    )}
                  </div>
                  <div className="p-3 bg-zinc-900 text-white flex-1 flex flex-col justify-between">
                    <p className="font-black text-sm tracking-wide line-clamp-1 text-center">{card.name}</p>
                    <div className="flex justify-between items-center mt-0.5 text-[10px] font-bold text-zinc-400">
                      <span>[{card.ip}]</span>
                      <span className="bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded-full text-zinc-300 font-black">★ {card.cost}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-5 flex flex-col justify-between h-[780px] gap-4">
            <div className="border-2 border-zinc-800 bg-zinc-900 rounded-2xl p-4 shadow-xl flex flex-col gap-2">
              <span className="text-xs font-black text-cyan-400">👤 [{userId}] 마스터 계정 클라우드 덱 ({savedDecks.length})</span>
              <div className="flex gap-2 overflow-x-auto py-1 max-h-[70px]">
                {savedDecks.length === 0 && <span className="text-[11px] text-zinc-600 font-bold py-2">클라우드 서버에 등록된 덱이 없습니다. 40장을 채워 등록하세요!</span>}
                {savedDecks.map(d => (
                  <div key={d.id} onClick={() => handleLoadDeck(d)} className="bg-zinc-950 border border-zinc-700 px-3 py-1.5 rounded-xl flex items-center gap-2 cursor-pointer hover:border-cyan-400 transition-colors text-xs font-bold whitespace-nowrap group">
                    <span className="text-cyan-400">⚡</span> {d.name}
                    <button onClick={(e) => handleDeleteDeck(d.id, e)} className="text-red-500 hover:text-red-400 font-black text-[10px] ml-1 opacity-40 group-hover:opacity-100">X</button>
                  </div>
                ))}
              </div>
              {deckCards.length === 40 && (
                <div className="flex gap-2 mt-1 border-t border-zinc-800 pt-2">
                  <input type="text" placeholder="서버에 영구 보존할 덱 이름..." value={newDeckName} onChange={(e) => setNewDeckName(e.target.value)} className="flex-1 px-3 py-1.5 bg-zinc-950 border border-zinc-700 text-white font-bold rounded-lg text-xs focus:outline-none" />
                  <button onClick={handleSaveDeck} className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-neutral-950 font-black text-xs rounded-lg shadow-md tracking-wider transition-transform active:scale-95">💾 계정에 덱 바인딩</button>
                </div>
              )}
            </div>

            <div onDragOver={(e) => e.preventDefault()} onDrop={onMainDeckDrop} className="border-4 border-zinc-800 p-4 h-[440px] max-h-[440px] bg-zinc-900 border-dashed flex flex-col rounded-3xl shadow-xl hover:bg-zinc-900/90 transition-colors relative overflow-hidden">
              <h3 className="font-black text-sm text-zinc-300 border-b-2 border-zinc-800 pb-2 mb-3 tracking-wide flex justify-between items-center">
                <span>📥 메인 덱 드롭 존 ({deckCards.length}/40장) <span className="text-[10px] text-red-400 font-bold ml-1">*(더블클릭 시 제거)</span></span>
                {deckCards.length === 40 && <span className="text-xs text-emerald-400 animate-bounce">✓ 40장 충족!</span>}
              </h3>
              <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-3 gap-3">
                {deckCards.length === 0 && <p className="col-span-3 text-xs text-zinc-500 text-center py-28 font-bold leading-relaxed">왼쪽 카드를 드래그하여 장전하세요.</p>}
                {deckCards.map((c, i) => (
                  <div key={c.instanceId || i} onDoubleClick={() => handleRemoveCardFromDeck(c.instanceId)} className="border border-zinc-700 rounded-xl overflow-hidden bg-zinc-950 shadow-md flex flex-col justify-between relative h-[140px] p-1 cursor-pointer hover:border-red-500/80 hover:scale-[0.98] transition-all group">
                    <div className="w-full h-[65%] bg-zinc-900 flex items-center justify-center rounded-lg overflow-hidden relative">
                      <img src={c.imgUrl} className="max-w-full max-h-full object-contain" alt="" />
                    </div>
                    <div className="bg-zinc-900 text-zinc-300 p-1 text-[10px] font-black truncate text-center rounded-md relative mt-1 select-none">
                      {c.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div onDragOver={(e) => e.preventDefault()} onDrop={onLeaderZoneDrop} className="border-4 border-zinc-800 border-dashed p-2 text-center rounded-2xl bg-zinc-900 hover:bg-zinc-900/80 flex flex-col items-center justify-center min-h-[150px] shadow-lg relative overflow-hidden">
                <span className="text-xs font-black text-zinc-400 z-10">👑 리더 드롭 존</span>
                {selectedLeader ? (
                  <div className="w-[190px] aspect-[4/3] border border-zinc-700 rounded-xl overflow-hidden mt-1 bg-neutral-950 shadow-2xl relative flex flex-col">
                    <div className="w-full flex-1 relative bg-black">
                      <div className="absolute inset-0 bg-no-repeat" style={{ backgroundImage: `url(${selectedLeader.imgUrl})`, backgroundPosition: 'center top', backgroundSize: '100% 200%' }}></div>
                    </div>
                    <p className="bg-zinc-800 text-[10px] font-black p-0.5 text-zinc-200 truncate border-t border-zinc-700 text-center">{selectedLeader.name}</p>
                  </div>
                ) : ( <span className="text-[10px] text-zinc-600 mt-2 z-10">가로형 리더 배치</span> )}
              </div>
              
              <button 
                onClick={handleToggleReady} 
                className={`border-4 rounded-2xl font-black text-xl transition-all duration-300 shadow-2xl active:scale-95 flex flex-col items-center justify-center gap-1 
                  ${isReady ? 'bg-emerald-600 border-emerald-400 text-neutral-950 hover:bg-emerald-500' : 'bg-rose-700 border-rose-500 text-white hover:bg-rose-600'}`}
              >
                <span>{isReady ? "🟢 준비완료" : "🔴 준비중"}</span>
                <span className="text-[9px] font-bold opacity-75">
                  {!isOpponentConnected ? "상대방 접속 대기 중..." : isReady ? "상대방 승인 대기 중..." : "40장 구성 시 매치 레디 토글"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. 인게임 화면 (컴팩트 뷰어 + 레벨 스택 엔진)
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 flex flex-col items-center justify-start select-none font-sans overflow-y-auto pb-12">
      
      {/* 상단 배너 */}
      <div className="w-full max-w-[1700px] sticky top-0 z-40 bg-zinc-900/95 border-b-4 border-zinc-800 p-3 flex justify-between items-center shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="bg-zinc-950 border border-cyan-500/30 px-4 py-1.5 rounded-xl text-center shadow-inner">
            <span className="text-[10px] text-zinc-400 font-bold block">👤 ME: {userId}</span>
            <span className="text-xs font-black text-cyan-400">내 상한: {leaderLevel + damageStack.length} 코스트</span>
          </div>
          <div className="bg-zinc-950 border border-red-500/30 px-4 py-1.5 rounded-xl text-center shadow-inner">
            <span className="text-[10px] text-zinc-400 font-bold block">🚨 OPPONENT: {oppUserId}</span>
            <span className="text-xs font-black text-red-400">적 상한: {oppLeaderLevel + oppDamageStack.length} 코스트</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setLeaderLevel(Math.min(10, leaderLevel + 1))} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 font-black text-xs rounded-md transition-colors">🔼 레벨업 (+1)</button>
          <button onClick={() => setIsLeaderFlipped(!isLeaderFlipped)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 font-black text-xs text-amber-400 rounded-md">🔃 리더 전환 (Flip)</button>
          <button onClick={() => setSkillZoneCards([])} className="px-3 py-1.5 bg-purple-900/40 border border-purple-500/30 text-white font-black text-xs rounded-md">🧹 내 스킬 제거</button>
          <button onClick={handleExitGame} className="px-3 py-1.5 bg-red-700 hover:bg-red-600 border border-red-500 text-red-100 font-black text-xs rounded-md shadow">🛑 대기방 복귀</button>
        </div>
      </div>

      <div className="w-full max-w-[1700px] flex flex-col gap-6 mt-4 px-4">
        
        {/* [상대방 플레이 매트] */}
        <div className="w-full bg-zinc-900 border-[6px] border-red-900/40 rounded-[28px] p-4 shadow-xl grid grid-cols-12 gap-4 relative">
          <div className="absolute -top-3 left-8 bg-red-600 text-white text-[10px] font-black px-4 py-0.5 rounded-full shadow-lg border border-red-400 z-10">🚨 OPPONENT MAT ({oppUserId})</div>
          
          {/* 상대 레벨 존 */}
          <div onClick={() => { if(oppLeaderCard) setMagnifiedCard({ ...oppLeaderCard, isLeaderType: true, leaderFlip: oppIsLeaderFlipped }); }} className="col-span-3 border-2 border-zinc-800 bg-zinc-950/40 rounded-xl p-3 flex flex-col justify-center relative shadow-inner min-h-[190px] cursor-pointer">
            <span className="absolute top-1 left-2 text-[9px] font-black text-red-400">적 리더 레벨 트랙 (LV {oppLeaderLevel})</span>
            <div className="w-full h-full flex items-center justify-start pl-4 relative overflow-visible mt-2">
              {oppLeaderCard ? (
                <div className="relative w-full h-full flex items-center overflow-visible">
                  {Array.from({ length: oppLeaderLevel }).map((_, idx) => {
                    const offsetTop = idx * -10;
                    return (
                      <div key={idx} className="absolute aspect-[4/3] h-[110px] rounded-lg border border-red-500 bg-black shadow-2xl overflow-hidden transition-all" style={{ top: `calc(45% + ${offsetTop}px)`, zIndex: idx + 1 }}>
                        <div className="absolute inset-0 bg-no-repeat" style={{ backgroundImage: `url(${oppLeaderCard.imgUrl})`, backgroundPosition: oppIsLeaderFlipped ? 'center bottom' : 'center top', backgroundSize: '100% 200%' }}></div>
                      </div>
                    );
                  })}
                  <div className="absolute right-4 bg-red-950/80 border border-red-500 px-3 py-1 rounded-md text-red-400 font-black text-sm z-50">LV {oppLeaderLevel}</div>
                </div>
              ) : <span className="text-zinc-700 text-xs m-auto">리더 대기 중</span>}
            </div>
          </div>

          {/* 상대 유닛 존 (확대경 장비 정찰 타겟 링크 활성화) */}
          <div className="col-span-5 border-2 border-zinc-800 bg-zinc-950/10 rounded-xl p-3 relative grid grid-cols-3 gap-3 items-stretch min-h-[190px]">
            {oppUnitZoneSlots.map((card, idx) => (
              <div key={idx} onClick={() => { if(card) setMagnifiedCard(card); }} className={`border-2 rounded-xl relative flex items-center justify-center p-0.5 transition-all overflow-hidden aspect-[1/1.4] m-auto w-full max-w-[120px] shadow-lg cursor-pointer ${card ? 'bg-zinc-950 border-red-500/60' : 'border-dashed border-zinc-800 bg-zinc-950/40 text-zinc-800 font-black text-xs'}`}>
                {card ? (
                  <div className="w-full h-full rounded-lg overflow-hidden flex flex-col bg-zinc-900">
                    <img src={card.imgUrl} className="w-full h-[78%] object-contain bg-black" alt="" />
                    <div className="bg-neutral-950 flex-1 flex flex-col justify-center items-center border-t border-zinc-800 text-[10px] font-black truncate px-1 text-zinc-400">
                      {card.name}
                      <span className="text-[8px] text-cyan-400">장비 ({card.items?.length || 0})</span>
                    </div>
                  </div>
                ) : `슬롯 ${3 - idx}`}
              </div>
            ))}
          </div>

          {/* 상대 대미지 존 & 상대 스킬 존 */}
          <div className="col-span-4 grid grid-rows-2 gap-2">
            <div onClick={() => { if(oppDamageStack.length > 0) setMagnifiedCard(oppDamageStack[oppDamageStack.length - 1]); }} className="border border-zinc-800 bg-zinc-950/20 rounded-xl p-1.5 flex items-center justify-start pl-4 relative cursor-pointer min-h-[85px]">
              <span className="absolute top-1 right-2 text-[8px] font-black text-red-500">대미지 스택 ({oppDamageStack.length})</span>
              {oppDamageStack.length === 0 ? <span className="text-zinc-700 text-[10px] font-bold">누적 대미지 없음</span> : (
                <div className="relative w-full h-full flex items-center overflow-visible">
                  {oppDamageStack.map((card, idx) => (
                    <div key={idx} className="absolute aspect-[1/1.4] h-[65px] rounded-md border border-red-500 bg-black shadow-md overflow-hidden" style={{ left: `${idx * 14}px`, zIndex: idx + 1 }}><img src={card.imgUrl} className="w-full h-full object-cover" alt="" /></div>
                  ))}
                </div>
              )}
            </div>
            <div className="border border-zinc-800 bg-zinc-950/20 rounded-xl p-1.5 flex gap-2 overflow-x-auto items-center min-h-[85px]">
              {oppSkillZoneCards.length === 0 && <span className="text-zinc-700 text-[9px] font-bold m-auto">활성 스킬 없음</span>}
              {oppSkillZoneCards.map((card, i) => (
                <div key={i} onClick={() => setMagnifiedCard(card)} className="aspect-[1/1.4] h-[65px] border border-purple-500 rounded-md overflow-hidden bg-black flex-shrink-0 cursor-pointer shadow"><img src={card.imgUrl} className="w-full h-full object-cover" alt="" /></div>
              ))}
            </div>
          </div>
        </div>

        {/* ====================================================
            [내 플레이 매트]
            ==================================================== */}
        <div className="w-full bg-zinc-900 border-[6px] border-cyan-900/40 rounded-[28px] p-4 shadow-xl grid grid-cols-12 gap-4 relative">
          <div className="absolute -top-3 left-8 bg-cyan-600 text-white text-[10px] font-black px-4 py-0.5 rounded-full shadow-lg border border-cyan-400 z-10">🔵 MY PLAY MAT</div>

          {/* ① 내 레벨 존 */}
          <div className="col-span-3 border-2 border-zinc-800 bg-zinc-950/40 rounded-xl p-3 flex flex-col justify-center relative shadow-inner min-h-[190px]">
            <span className="absolute top-1 left-2 text-[9px] font-black text-cyan-400">내 리더 레벨 트랙 (LV {leaderLevel})</span>
            <div className="w-full h-full flex items-center justify-start pl-4 relative overflow-visible mt-2">
              {selectedLeader ? (
                <div className="relative w-full h-full flex items-center overflow-visible">
                  {Array.from({ length: leaderLevel }).map((_, idx) => {
                    const offsetTop = idx * -10;
                    return (
                      <div key={idx} className="absolute aspect-[4/3] h-[110px] rounded-lg border-2 border-cyan-500 bg-black shadow-2xl overflow-hidden transition-all" style={{ top: `calc(45% + ${offsetTop}px)`, zIndex: idx + 1 }}>
                        <div className="absolute inset-0 bg-no-repeat transition-all duration-300" style={{ backgroundImage: `url(${selectedLeader.imgUrl})`, backgroundPosition: isLeaderFlipped ? 'center bottom' : 'center top', backgroundSize: '100% 200%', opacity: 0.95 }}></div>
                      </div>
                    );
                  })}
                  <div className="absolute right-4 flex flex-col gap-1 z-50">
                    <div className="bg-zinc-950 border-2 border-cyan-500 px-3 py-1 rounded-md text-cyan-400 font-black text-sm text-center">LV {leaderLevel}</div>
                    <button onClick={() => setLeaderLevel(Math.max(1, leaderLevel - 1))} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-[9px] py-0.5 rounded border border-zinc-700">Level -1</button>
                  </div>
                </div>
              ) : <span className="text-zinc-600 text-xs m-auto">리더 카드가 없습니다</span>}
            </div>
          </div>

          {/* ③ 내 유닛 존 */}
          <div className="col-span-5 border-4 border-zinc-800 bg-zinc-950/20 rounded-2xl p-3 relative grid grid-cols-3 gap-3 items-stretch min-h-[190px]">
            {unitZoneSlots.map((card, idx) => (
              <div key={idx} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onUnitSlotDrop(e, idx)} className={`border-4 rounded-2xl relative flex flex-col items-center justify-center p-0.5 transition-all overflow-hidden aspect-[1/1.4] m-auto w-full max-w-[120px] shadow-xl ${card ? 'bg-zinc-950 border-cyan-600/80 shadow-cyan-900/40' : 'border-dashed border-zinc-800 bg-zinc-950/40 text-zinc-700 font-black text-xs'}`}>
                {card ? (
                  <div onDoubleClick={() => handleKillUnit(idx)} className="w-full h-full rounded-xl overflow-hidden flex flex-col bg-zinc-900 cursor-pointer">
                    <img src={card.imgUrl} className="w-full h-[72%] object-contain bg-black" alt="" />
                    <div className="p-1 bg-neutral-950 flex-1 flex flex-col justify-between text-center border-t border-zinc-800">
                      <p className="font-black text-[9px] text-white truncate leading-none mt-0.5">{card.name}</p>
                      <button onClick={(e) => { e.stopPropagation(); setInspectingUnitIndex(idx); }} className="w-full py-0.5 bg-zinc-800 border border-zinc-700 text-zinc-300 font-black text-[8px] rounded">장비 ({card.items?.length || 0})</button>
                    </div>
                  </div>
                ) : ( <span>슬롯 {idx + 1}</span> )}
              </div>
            ))}
          </div>

          {/* ② 내 대미지 존 & ④ 내 스킬 존 */}
          <div className="col-span-4 grid grid-rows-2 gap-2">
            <div onDragOver={(e) => e.preventDefault()} onDrop={onDamageStackDrop} onDoubleClick={handlePopDamageStack} className="border-4 border-zinc-800 bg-zinc-950/30 rounded-2xl p-2 flex flex-col justify-center relative shadow-inner overflow-visible min-h-[85px]">
              <span className="absolute -top-2.5 left-3 bg-rose-700 text-white text-[8px] font-black px-1.5 py-0.2 rounded shadow">② 내 대미지 *(더블클릭 무덤행)*</span>
              <div className="w-full h-full flex items-center justify-start pl-4 relative overflow-visible">
                {damageStack.length === 0 ? <span className="text-zinc-600 text-[10px] font-black mx-auto">누적 대미지 없음</span> : (
                  <div className="relative w-full h-full flex items-center overflow-visible">
                    {damageStack.map((card, idx) => (
                      <div key={idx} className="absolute aspect-[1/1.4] h-[65px] rounded-lg border border-rose-600 bg-zinc-950 shadow-md overflow-hidden" style={{ left: `${idx * 16}px`, zIndex: idx + 1 }}><img src={card.imgUrl} className="w-full h-full object-cover" alt="" /></div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div onDragOver={(e) => e.preventDefault()} onDrop={onSkillZoneDrop} className="border-4 border-zinc-800 bg-zinc-950/20 rounded-2xl p-2 flex flex-col items-center justify-center relative min-h-[85px]">
              <div className="w-full flex-1 overflow-y-auto grid grid-cols-4 gap-1 p-0.5 max-h-[70px]">
                {skillZoneCards.map((card, i) => (
                  <div key={i} className="aspect-[1/1.4] w-full max-w-[35px] mx-auto border border-purple-500 rounded overflow-hidden relative shadow"><img src={card.imgUrl} className="absolute inset-0 w-full h-full object-cover" alt="" /></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ⑤ 내 덱 존 & ⑥ 내 트래시 존 패널 */}
        <div className="w-full grid grid-cols-2 gap-4">
          <div onClick={() => setIsDeckSelectModalOpen(true)} className="border-2 border-zinc-800 bg-zinc-900/60 rounded-2xl p-4 flex items-center justify-center gap-4 relative cursor-pointer hover:bg-zinc-800/40 shadow-lg min-h-[100px]">
            <span className="absolute -top-2.5 left-4 bg-blue-600 text-white text-[9px] font-black px-2 py-0.2 rounded shadow">⑤ 내 덱 존 ({myFullDeckList.length}장 남음)</span>
            {topOfDeckCard ? (
              <div draggable onDragStart={onDeckDragStart} className="aspect-[1/1.4] h-[75px] border-2 border-amber-500 bg-zinc-950 rounded-lg overflow-hidden flex flex-col justify-between shadow-2xl cursor-grab active:cursor-grabbing relative">
                <img src={topOfDeckCard.imgUrl} className="w-full h-[70%] object-contain bg-black" alt="" />
                <div className="bg-neutral-950 p-0.2 flex-1 flex items-center justify-center border-t border-zinc-800"><p className="text-[7px] font-black text-amber-400 truncate text-center w-full">{topOfDeckCard.name}</p></div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-zinc-500 font-bold text-xs">
                <div className="w-8 h-12 border border-dashed border-zinc-700 rounded flex items-center justify-center font-black">CLICK</div>
                <span>손패 가상 장전하기</span>
              </div>
            )}
          </div>

          <div onClick={() => setIsTrashModalOpen(true)} className="border-2 border-zinc-800 bg-zinc-900/60 rounded-2xl p-4 flex items-center justify-center gap-4 relative cursor-pointer hover:bg-zinc-800/40 shadow-lg min-h-[100px]">
            <span className="absolute -top-2.5 left-4 bg-zinc-600 text-zinc-300 text-[9px] font-black px-2 py-0.2 rounded shadow">⑥ 트래시 존 (적 덱: {oppDeckCount}장 / 적 무덤: {oppTrashCount}장)</span>
            <div className="text-center flex items-center gap-3">
              <span className="text-2xl font-black text-zinc-400">{trashDeck.length} <span className="text-xs text-zinc-600 font-bold">장 무덤 누적</span></span>
            </div>
          </div>
        </div>

      </div>

      {/* 내 덱 선택 장전 모달 */}
      {isDeckSelectModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border-4 border-zinc-700 rounded-2xl w-full max-w-4xl p-6 shadow-2xl flex flex-col max-h-[600px]">
            <div className="flex justify-between items-center border-b-2 border-zinc-800 pb-3 mb-4">
              <h3 className="text-lg font-black text-zinc-300">🎴 현실과 동기화하여 꺼낼 카드를 선택하세요 ({myFullDeckList.length}장)</h3>
              <button onClick={() => setIsDeckSelectModalOpen(false)} className="text-xs bg-rose-950 border border-rose-700 hover:bg-rose-900 px-4 py-1.5 rounded-md text-rose-200 font-bold">닫기 X</button>
            </div>
            <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-4 gap-4 p-1">
              {myFullDeckList.map((card, idx) => (
                <div key={card.instanceId || idx} onClick={() => { setTopOfDeckCard(card); setIsDeckSelectModalOpen(false); }} className="border-2 border-zinc-800 rounded-xl overflow-hidden bg-zinc-950 cursor-pointer hover:border-zinc-500 hover:scale-[1.03] transition-all flex flex-col justify-between h-[260px] shadow-xl p-1">
                  <div className="w-full h-[78%] bg-black flex items-center justify-center p-2 rounded-lg overflow-hidden"><img src={card.imgUrl} className="max-w-full max-h-full object-contain rounded" alt="" /></div>
                  <div className="p-2 bg-zinc-900 text-xs font-black truncate text-zinc-300 border-t border-zinc-800 text-center rounded-b-lg">{card.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 내 무덤 확인 모달 */}
      {isTrashModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border-4 border-zinc-700 rounded-2xl w-full max-w-lg p-6 flex flex-col">
            <div className="flex justify-between items-center border-b-2 border-zinc-800 pb-2 mb-4">
              <h3 className="text-zinc-300 font-bold">내 트래시 존 (무덤 수거)</h3>
              <button onClick={() => setIsTrashModalOpen(false)} className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded-md border border-zinc-600 text-zinc-300">닫기 X</button>
            </div>
            <div className="grid grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-1">
              {trashDeck.map((card, idx) => (
                <div key={idx} className="border-2 border-zinc-800 rounded-xl overflow-hidden bg-zinc-950 flex flex-col justify-between shadow">
                  <div className="w-full h-16 bg-black flex items-center justify-center p-1"><img src={card.imgUrl} className="max-w-full max-h-full object-contain" alt="" /></div>
                  <span className="p-1 text-[9px] font-bold text-center truncate bg-zinc-900 text-zinc-400 block border-t border-zinc-800">{card.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); setMyFullDeckList([...myFullDeckList, { ...card, instanceId: `card-${Date.now()}-${Math.random()}` }]); setTrashDeck(trashDeck.filter((_, i) => i !== idx)); setIsTrashModalOpen(false); }} className="w-full py-1 bg-zinc-800 text-amber-400 font-black text-[10px]">무덤 복구</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 내 유닛 장착 장비 관리 모달 */}
      {inspectingUnitIndex !== null && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border-4 border-zinc-700 rounded-2xl w-full max-w-lg p-6 flex flex-col">
            <div className="flex justify-between items-center border-b-2 border-zinc-800 pb-3 mb-4">
              <h3 className="text-lg font-bold text-zinc-300">Slot {inspectingUnitIndex + 1} [{unitZoneSlots[inspectingUnitIndex]?.name}] 장착 장비</h3>
              <button onClick={() => setInspectingUnitIndex(null)} className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300">닫기 X</button>
            </div>
            <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto p-1">
              {unitZoneSlots[inspectingUnitIndex]?.items?.map((item, idx) => (
                <div key={idx} className="border-2 border-zinc-800 rounded-xl overflow-hidden bg-zinc-950 flex flex-col shadow"><div className="w-full h-28 bg-black flex items-center justify-center p-1"><img src={item.imgUrl} className="max-w-full max-h-full object-contain" alt="" /></div><span className="p-1.5 bg-zinc-900 text-[10px] font-black text-center truncate border-t border-zinc-800 text-zinc-300">{item.name}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          [피드백 3 특수 구현]: 상대방 카드 클릭 시 나타나는 대형 정찰 돋보기 모달
          *(상대 유닛이 장착 중인 아이템 실시간 추적 렌더링 스크롤망 탑재 완료)*
          ==================================================== */}
      {magnifiedCard && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-[100] animate-fade-in p-4">
          <div className="relative bg-zinc-900 border-4 border-zinc-700 p-6 rounded-3xl shadow-[0_0_60px_rgba(239,68,68,0.25)] max-w-full flex gap-6 items-start">
            <button onClick={() => setMagnifiedCard(null)} className="absolute -top-6 -right-6 bg-red-600 hover:bg-red-500 border-2 border-white text-white w-12 h-12 rounded-full flex items-center justify-center font-black text-2xl shadow-2xl transition-all cursor-pointer z-[110]">✕</button>
            
            {/* 왼쪽: 확대 일러스트 기판 */}
            <div className="flex flex-col items-center gap-4">
              {magnifiedCard.isLeaderType ? (
                <div className="w-[420px] aspect-[4/3] rounded-2xl border-4 border-amber-500 bg-black shadow-inner relative overflow-hidden">
                  <div className="absolute inset-0" style={{ backgroundImage: `url(${magnifiedCard.imgUrl})`, backgroundPosition: magnifiedCard.leaderFlip ? 'center bottom' : 'center top', backgroundSize: '100% 200%' }}></div>
                </div>
              ) : (
                <div className="w-[300px] aspect-[1/1.4] bg-zinc-950 rounded-2xl overflow-hidden border-2 border-zinc-700 p-1 flex items-center justify-center shadow-inner"><img src={magnifiedCard.imgUrl} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" alt="" /></div>
              )}
              <div className="text-center bg-zinc-950/80 px-4 py-2 rounded-xl border border-red-900/40 shadow-md w-full">
                <h4 className="text-base font-black text-red-400 tracking-wide border-b border-zinc-800 pb-1 mb-1">{magnifiedCard.name}</h4>
                <div className="flex justify-between items-center text-[11px] font-bold text-zinc-400">
                  <span>IP: <span className="text-amber-400">[{magnifiedCard.ip}]</span></span>
                  <span>타입: <span className="text-zinc-200">{magnifiedCard.type}</span></span>
                  <span>★ <span className="text-white">{magnifiedCard.cost}</span></span>
                </div>
              </div>
            </div>

            {/* 오른쪽: [수정사항 3 구현] 상대 유닛 장착 아이템 정찰 레이더 전용 모달 패널 */}
            {!magnifiedCard.isLeaderType && magnifiedCard.type === 'Unit' && (
              <div className="w-[280px] bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 flex flex-col h-[460px]">
                <h5 className="text-xs font-black text-cyan-400 border-b border-zinc-800 pb-2 mb-3 tracking-wide flex justify-between items-center">
                  <span>🛰️ 상대방 장착 장비 실시간 정찰</span>
                  <span className="bg-cyan-950 px-2 py-0.5 rounded-full text-[10px] text-cyan-300">{magnifiedCard.items?.length || 0}개</span>
                </h5>
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {(!magnifiedCard.items || magnifiedCard.items.length === 0) && (
                    <p className="text-[11px] text-zinc-600 text-center py-44 font-bold">현재 장착된 아이템이 없습니다.</p>
                  )}
                  {magnifiedCard.items?.map((item, sIdx) => (
                    <div key={sIdx} className="border border-zinc-800 bg-zinc-900 rounded-xl p-2 flex items-center gap-3 shadow-md">
                      <div className="w-10 h-14 bg-black rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
                        <img src={item.imgUrl} className="max-w-full max-h-full object-contain" alt="" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-xs text-zinc-200 truncate">{item.name}</p>
                        <p className="text-[9px] font-bold text-zinc-500 mt-0.5">[{item.ip}] Item</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

export default App;