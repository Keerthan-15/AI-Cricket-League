import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const currentFilePath = (typeof import.meta !== 'undefined' && import.meta && import.meta.url)
  ? fileURLToPath(import.meta.url)
  : (typeof __filename !== 'undefined' ? __filename : '');

const currentDirPath = (typeof import.meta !== 'undefined' && import.meta && import.meta.url)
  ? path.dirname(currentFilePath)
  : (typeof __dirname !== 'undefined' ? __dirname : '');

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = 3000;

// Initialize the GoogleGenAI client lazily or when endpoints are called
let ai: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is missing. Configure it in the Secrets panel.');
    }
    ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return ai;
}

// Utility to limit how long a Promise can block for
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage = 'Operation timed out'): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

// ----------------------------------------------------
// MATCH SCHEMAS & PROMPTS FOR GEMINI API
// ----------------------------------------------------

const playerSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    role: { type: Type.STRING },
    rating: { type: Type.INTEGER }
  },
  required: ['name', 'role', 'rating']
};

const ballEventSchema = {
  type: Type.OBJECT,
  properties: {
    ball: { type: Type.INTEGER, description: 'Ball number of the over (1 to 6)' },
    type: { type: Type.STRING, description: 'One of: dot, run, boundary, wicket, extra' },
    runsScored: { type: Type.INTEGER, description: 'Runs scored on this specific ball' },
    description: { type: Type.STRING, description: 'Live, fast-paced ball-by-ball description' }
  },
  required: ['ball', 'type', 'runsScored', 'description']
};

const overSimulationSchema = {
  type: Type.OBJECT,
  properties: {
    overNumber: { type: Type.INTEGER, description: 'The over number (1-20)' },
    runs: { type: Type.INTEGER, description: 'Runs scored in this over' },
    commentary: { type: Type.STRING, description: 'A witty, energetic 1-2 sentence recap of the general highlights' },
    wicketsList: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          player: { type: Type.STRING, description: 'Name of batsman out' },
          howOut: { type: Type.STRING, description: 'Brief description, e.g. "c Rahul b Bumrah" or "Bowled!"' },
          bowler: { type: Type.STRING, description: 'Bowler name' }
        },
        required: ['player', 'howOut', 'bowler']
      }
    },
    timeline: {
      type: Type.ARRAY,
      items: ballEventSchema,
      description: 'The events of each ball in the over (at least 6)'
    }
  },
  required: ['overNumber', 'runs', 'commentary', 'wicketsList', 'timeline']
};

const batsmanStatsSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    runs: { type: Type.INTEGER },
    balls: { type: Type.INTEGER },
    fours: { type: Type.INTEGER },
    sixes: { type: Type.INTEGER },
    out: { type: Type.BOOLEAN },
    howOut: { type: Type.STRING, description: 'E.g., "not out" or "c Kohlib Chahal"' }
  },
  required: ['name', 'runs', 'balls', 'fours', 'sixes', 'out', 'howOut']
};

const bowlerStatsSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    overs: { type: Type.NUMBER, description: 'Overs bowled, e.g. 20.0 or 3.2' },
    runs: { type: Type.INTEGER },
    wickets: { type: Type.INTEGER },
    extras: { type: Type.INTEGER }
  },
  required: ['name', 'overs', 'runs', 'wickets', 'extras']
};

const inningsSchema = {
  type: Type.OBJECT,
  properties: {
    battingTeam: { type: Type.STRING },
    bowlingTeam: { type: Type.STRING },
    totalRuns: { type: Type.INTEGER },
    totalWickets: { type: Type.INTEGER },
    totalOvers: { type: Type.NUMBER, description: 'E.g. 20.0 or 18.3' },
    overs: {
      type: Type.ARRAY,
      items: overSimulationSchema,
      description: 'Strict list of simulated overs (1 to 20, or fewer if chased/all out). Limit to max 20.'
    },
    batsmen: {
      type: Type.ARRAY,
      items: batsmanStatsSchema
    },
    bowlers: {
      type: Type.ARRAY,
      items: bowlerStatsSchema
    }
  },
  required: ['battingTeam', 'bowlingTeam', 'totalRuns', 'totalWickets', 'totalOvers', 'overs', 'batsmen', 'bowlers']
};

const matchResponseSchema = {
  type: Type.OBJECT,
  properties: {
    toss: {
      type: Type.OBJECT,
      properties: {
        winner: { type: Type.STRING },
        decision: { type: Type.STRING, description: "Either 'bat' or 'bowl'" },
        commentary: { type: Type.STRING, description: 'Commentary dialogue from the pitch report and toss session' }
      },
      required: ['winner', 'decision', 'commentary']
    },
    innings1: inningsSchema,
    innings2: inningsSchema,
    result: {
      type: Type.OBJECT,
      properties: {
        winner: { type: Type.STRING },
        margin: { type: Type.STRING, description: 'E.g. "Mumbai Titans won by 12 runs" or "Chennai Super Kings won by 6 wickets"' },
        summary: { type: Type.STRING, description: 'Key turning points and highlights of the match' },
        playerOfTheMatch: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            reason: { type: Type.STRING },
            stats: { type: Type.STRING, description: 'Small stats summary, e.g. "72 (41) & 1/14"' }
          },
          required: ['name', 'reason', 'stats']
        },
        presentationCommentary: { type: Type.STRING, description: 'Includes quotes from the losing captain, winning captain, and Player of the Match during the presentation ceremony' },
        gullyCommentary: { type: Type.STRING, description: 'The comprehensive, high josh Karnataka Gully Commentary matching the user-requested format, slang, and emojis.' }
      },
      required: ['winner', 'margin', 'summary', 'playerOfTheMatch', 'presentationCommentary', 'gullyCommentary']
    }
  },
  required: ['toss', 'innings1', 'innings2', 'result']
};

// ----------------------------------------------------
// LOCAL FALLBACK ENGINES (FOR 503 SERVICE UNAVAILABLE DEGRADATION)
// ----------------------------------------------------

function simulateLocalMatchFallback(
  teamAName: string,
  teamBName: string,
  teamAPlayers: any[],
  teamBPlayers: any[],
  captainA?: string,
  viceCaptainA?: string,
  impactPlayerA?: string,
  captainB?: string,
  viceCaptainB?: string,
  impactPlayerB?: string
): any {
  const teams = [teamAName, teamBName];
  const tossWinner = teams[Math.floor(Math.random() * 2)];
  const tossLoser = tossWinner === teamAName ? teamBName : teamAName;
  const tossDecision = Math.random() > 0.5 ? 'bat' : 'bowl';

  const firstBattingTeam = tossDecision === 'bat' ? tossWinner : tossLoser;
  const firstBowlingTeam = firstBattingTeam === teamAName ? teamBName : teamAName;

  const firstBattingPlayers = firstBattingTeam === teamAName ? teamAPlayers : teamBPlayers;
  const firstBowlingPlayers = firstBowlingTeam === teamAName ? teamAPlayers : teamBPlayers;

  const tossCommentary = `Pitch is dry, hard and ready guru! Captains at the center. Toss coin spins... and won by ${tossWinner}! They chose to ${tossDecision} first under full josh!`;

  // Commentary Variety System pools
  const SIX_POOL = [
    "🚀 Straight back over the bowler's head! Yen timing guru, absolute cinema!",
    "🔥 Picked up over deep midwicket! Direct into the crowd, what a launch!",
    "💥 Long On Six! Clean swing of the bat into the stands! Absolute monster hit!",
    "🌟 Long Off Six! Lofted drive high and handsome over long-off! Smooth as silk!",
    "⚡ Sweep Six! Dropped on one knee and launched into the square leg boundary!",
    "🚀 Reverse Sweep Six! Incredible audacity, over backward point! Bowler is shocked!",
    "💥 Pull Shot Six! Dispatched short ball high into the deep backward square stands!",
    "🏏 Inside Out Six! Over extra cover, beautiful wrist work, what a shot guru!",
    "🔥 Lofted Drive Six! Elegant high loft over the bowler's head, crowd ge pure habba!",
    "🚀 Deep Midwicket Six! Effortless pick up over deep midwicket, absolute timing!",
    "⚡ Straight Six! Hammered right back past the umpire, bowler has no answer!",
    "💥 Long On Six! Standing and delivering with pure brute force, yen timing guru!",
    "☄️ Long Off Six! Clears the rope with elegant extension, absolute luxury!",
    "✨ Upper Cut Six! Slashed over third man into the stands, what a visual!",
    "🔥 Pull Shot Six! Sledgehammered over midwicket, absolute beast of a shot!",
    "🏏 Inside Out Six! Steppped out and carved over cover, yen shot guru!",
    "🚀 Long On Six! Massive launch over long-on, ball direct crowd ge gift!",
    "☄️ Long Off Six! High into the night sky, clears the fence easily!",
    "⚡ Straight Six! Clattered over the sight screen, what a strike!",
    "💥 Deep Midwicket Six! Flicked off the pads with sensational wristwork!",
    "🌟 Sweep Six! Slogged over deep midwicket, incredible elevation!",
    "✨ Upper Cut Six! Guided over third man with superb ramp style!",
    "🏏 Lofted Drive Six! Smashed down the ground, into the second tier!",
    "🔥 Pull Shot Six! Cracking pull over deep square leg, what a sound!",
    "🚀 Inside Out Six! Carved over wide long-off, pure genius!"
  ];

  const FOUR_POOL = [
    "🏏 Elegant cover drive races away! Pure timing, no fielder has a chance!",
    "🔥 Pull Shot! Sizzling pull shot through deep midwicket, yen speed guru!",
    "⚡ Cover Drive! Perfectly leaned into the drive, elegant cover drive races away!",
    "💥 Lofted Drive! Pierced the infield with a glorious lofted drive to the boundary!",
    "✨ Upper Cut! Slashed over slips with an audacious upper cut for four!",
    "🔄 Sweep! Guided beautifully through backward square leg!",
    "🔃 Reverse Sweep! Reverse swept with incredible speed past point, yen shot guru!",
    "🏏 Inside Out Shot! Carved elegantly over extra cover for a classic boundary!",
    "🔥 Straight Drive! Sublime straight drive past the bowler, absolute timing!",
    "⚡ Cut Shot! Slashed hard through backward point for a rapid four!",
    "💥 Flick Shot! Just flicked off the boot, races to the midwicket boundary!",
    "✨ Square Cut! Exquisite square cut, backward point can only watch!",
    "🔄 Reverse Sweep! Played with pure genius to the vacant boundary!",
    "🏏 Cover Drive! Classic text-book cover drive, creamed past cover!",
    "🔥 Pull Shot! Back of a length pulled autoritatively through square leg!",
    "⚡ Inside Out Shot! Dances down and inside-out over cover, breathtaking!",
    "💥 Upper Cut! Guided over the keeper's head, boundary in a flash!",
    "✨ Lofted Drive! Clears mid-off, one bounce and over the boundary rope!",
    "🔄 Sweep! Swept hard and low into the deep square leg boundary!",
    "🏏 Bowler is stunned! Driven straight past mid-on, class written all over it!",
    "🔥 On Drive! Elegant push past mid-on, timed to perfection!",
    "⚡ Late Cut! Whispered past short third man, delicate and delicious boundary!",
    "💥 Pull Shot! Savage pull through midwicket, no chance for the deep fielders!",
    "✨ Cover Drive! Out of the slot and driven beautifully, crowd is dancing!",
    "🏏 Reverse Sweep! Elegant reverse slap past short third, yen timing guru!"
  ];

  const WICKET_POOL = [
    "🚨🚨🚨 OUTTTTT!!!! Clean bowled! The middle stump is cartwheeling, absolute drama!",
    "🔴 WICKET! Caught at slip! Beautiful outswinger, batsman nicked it straight to hands!",
    "🚨 OUT! Caught! batsman tried to clear long-on but holed out straight to the fielder!",
    "🔴 WICKET! Bowled him! batsman played all around the straight one, woodwork shattered!",
    "🚨 OUT! LBW! Plumb in front, umpire raises the finger instantly, bowler is ecstatic!",
    "🔴 WICKET! Caught behind! Faint edge and keeper makes a diving catch under high pressure!",
    "🚨 OUT! batsman went for a big pull but top-edged it, keeper takes an easy catch!",
    "🔴 WICKET! Stumped! batsman stepped out, missed the turn completely, keeper does the rest!",
    "🚨 OUT! Caught at deep midwicket! Tried to clear the boundary but didn't find the distance!",
    "🔴 WICKET! Chipped straight to cover! Soft dismissal, batsman is absolutely gutted!",
    "🚨 OUT! Caught and bowled! Bowler reacts quickly and plucks it out of thin air!",
    "🔴 WICKET! Slower ball does the trick! batsman is early into the shot, caught at mid-off!",
    "🚨 OUT! Castled! Yorker length drills through the defense, middle pole knocked back!",
    "🔴 WICKET! Brilliant catch at cover! Fielder dives to his right, absolute stunner!",
    "🚨 OUT! Trapped in front! No debate there, batsman walking back oru review was useless!",
    "🔴 WICKET! Leading edge flies straight to point! Match-turning breakthrough!",
    "🚨 OUT! Slogged straight into the hands of deep square leg. Fielder didn't move an inch!",
    "🔴 WICKET! Dragged onto the stumps! Looking to cut a ball too close to body!",
    "🚨 OUT! Caught at mid-on! Mistimed lofted shot, easy take under high skies!",
    "🔴 WICKET! Plumb LBW! Tailor-made delivery, batsman had no answer, yen delivery!",
    "🚨 OUT! Tried a reverse sweep, gets a top edge straight into the keeper's gloves!",
    "🔴 WICKET! Beautifully setup! Outswinger followed by standard offcutter, clean bowled!",
    "🚨 OUT! Caught at short fine leg! Tried to scoop but got an inside edge onto pad and up!",
    "🔴 WICKET! Smashed straight to extra cover fielder, absolute rocket of a catch!",
    "🚨 OUT! Edge and taken! Magnificent catch by keeper diving full stretch!"
  ];

  const RUNOUT_POOL = [
    "🏃‍♂️ RUN OUT! Dramatic mix-up! Both batsmen at the same end, absolute disaster, yen run out!",
    "⚡ RUN OUT! Direct hit! Fielders throws from deep, hitting the stumps, batsman is short!",
    "🏃‍♂️ RUN OUT! batsman didn't expect the quick throw, keeper whips the bails off in a flash!",
    "⚡ RUN OUT! Hesitation cost them! A sharp single became a tragic run-out at the non-striker's end!",
    "🏃‍♂️ RUN OUT! Checker says out! Sliding stop and quick accurate throw catches him short!",
    "⚡ RUN OUT! Terribly slow reaction, fielder intercepts and strikes the stumps directly!",
    "🏃‍♂️ RUN OUT! Oh no, absolute panic! Middle of the pitch discussion leads to easy run out!",
    "⚡ RUN OUT! Keeper reacts like lightning, picks up and takes down the stumps!",
    "🏃‍♂️ RUN OUT! Bullseye from extra cover! batsman is miles out of his crease!",
    "⚡ RUN OUT! Miscommunication! A flat refusal from the captain, but partner ran anyway!",
    "🏃‍♂️ RUN OUT! Fielder strikes from deep midwicket! Precision accuracy under pressure!",
    "⚡ RUN OUT! batsman tried to sneak a second run, but fielder's rapid arm ended the dream!",
    "🏃‍♂️ RUN OUT! Tragic end! batsman slipped while taking the turn, easy run out!",
    "⚡ RUN OUT! Point fielder fires in a superb direct throw! Outstanding athletics!",
    "🏃‍♂️ RUN OUT! Bowler deflects the straight drive onto the non-striker stumps, unlucky!"
  ];

  const FINALOVER_POOL = [
    "🚨 LAST OVER DRAMA! Heartbeats are peaking! Captain gives the ball to his match-winner!",
    "⏳ FINAL OVER SHOWDOWN! Crowds are standing, absolute tension in the air, who wins?!",
    "🚨 20th Over! High intensity, bowler run up builds, batsman is ready to swing!",
    "⏳ Tension at absolute peak! 20th over begins under massive noise and chanting!",
    "🚨 Final Over! Bowling team defense is on, fields adjusted, absolute high pressure!",
    "⏳ The climax over is here! Bowler speeds in with nerves of steel, batsman in full focus!",
    "🚨 Climax under way! Every ball of this 20th over is worth gold!",
    "⏳ Over 20 begins! Stadium is a sea of flashlights, pure drama and cinema!",
    "🚨 Final 6 deliveries! Captain is nervous, bowler breathes deep, ready to deliver!",
    "⏳ High drama! Bowler is sprinting in, looking for the yorker to save the match!",
    "🚨 Final Over! batsman clears front leg, bowler runs in under intense spotlights!",
    "⏳ 20th over chaos! All fielders on boundaries, bowler runs up with focus!",
    "🚨 Climax time macha! Nerves are like wires, absolute peak cricket entertainment!",
    "⏳ final over is on fire! Wide line yorker targeted, batsman lunges forward!",
    "🚨 Heart in your mouth moment! Over 20 begins, yen climax guru!",
    "⏳ High voltage in the 20th over! Every single run is celebrated like a trophy!",
    "🚨 Decisive six balls remain! Bowler has to defend or batsman has to finish, high pressure!",
    "⏳ Climax under lights! Bowler releases, targeted at the block hole, grand suspense!",
    "🚨 Last over under progress! Stadium is roaring, yen action guru, pure edge of seat!",
    "⏳ Climax over begins! Six balls to destiny, crowd has gone absolutely wild!"
  ];

  const silentDotComments = [
    "defends it gently back to the bowler on a good length.",
    "Excellent length ball. Played with a straight bat, no run.",
    "Beaten! Quick delivery whistles past the batsman's outside edge.",
    "Short of a length delivery, defended off the back foot quietly.",
    "Flatter delivery, chopped straight to cover, no run.",
    "lunges forward and blocks it with soft hands.",
    "No run. Clipped off the hips but straight to short midwicket."
  ];

  const silentSingleComments = [
    "works it to deep midwicket for a single.",
    "drives it softly to deep cover for a comfortable run.",
    "Pushed wide of cover and the batsmen quickly exchange ends.",
    "Tickled down leg side, neat running fetches a quick run.",
    "guides it down to short third man for a quick single."
  ];

  const silentTwoComments = [
    "punches it off the backfoot, superb running fetches a couple.",
    "Driven wide of deep point, batsmen hustle hard to complete two runs.",
    "Clipped through midwicket, they run the first one hard and return for two.",
    "Shorter delivery pulled softly, comfortable two runs taken."
  ];

  // Keep track of used comments to prevent repeating in SINGLE match
  const usedSixIdx: number[] = [];
  const usedFourIdx: number[] = [];
  const usedWicketIdx: number[] = [];
  const usedRunOutIdx: number[] = [];
  const usedFinalOverIdx: number[] = [];

  const getUniqueComment = (pool: string[], usedArray: number[]): string => {
    let available = pool.map((_, idx) => idx).filter(idx => !usedArray.includes(idx));
    if (available.length === 0) {
      usedArray.length = 0; // reset
      available = pool.map((_, idx) => idx);
    }
    const idx = available[Math.floor(Math.random() * available.length)];
    usedArray.push(idx);
    return pool[idx];
  };

  const simulateInnings = (
    battingTeam: string,
    bowlingTeam: string,
    battingPlayers: any[],
    bowlingPlayers: any[],
    targetToChase?: number
  ) => {
    const batsmen = battingPlayers.map((p: any) => ({
      name: p.name,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: false,
      howOut: 'not out'
    }));

    const bowlerList = bowlingPlayers.filter((p: any) => 
      p?.role?.toLowerCase().includes('bowler') || p?.role?.toLowerCase().includes('all')
    );
    let selectedBowlers = [...bowlerList];
    if (selectedBowlers.length < 3) {
      for (const p of bowlingPlayers) {
        if (selectedBowlers.length >= 3) break;
        if (p && p.name && !selectedBowlers.some(b => b.name === p.name)) {
          selectedBowlers.push(p);
        }
      }
    }
    if (selectedBowlers.length === 0) {
      selectedBowlers = [{ name: 'Default Bowler', role: 'Bowler' }];
    }
    
    const bowlerStatsMap = new Map<string, {
      name: string;
      balls: number;
      runs: number;
      wickets: number;
      extras: number;
    }>();

    selectedBowlers.forEach((p: any) => {
      bowlerStatsMap.set(p.name, {
        name: p.name,
        balls: 0,
        runs: 0,
        wickets: 0,
        extras: 0
      });
    });

    const getBowlerForOver = (overNo: number) => {
      const b = selectedBowlers[(overNo - 1) % selectedBowlers.length];
      return bowlerStatsMap.get(b.name)!;
    };

    let totalRuns = 0;
    let totalWickets = 0;
    let extrasCount = 0;
    let totalBallsBowled = 0;

    let bat1Idx = 0;
    let bat2Idx = 1;
    let strikeIdx = 0; // 0 for bat1, 1 for bat2
    let nextBatIdx = 2;

    const oversSimulated: any[] = [];

    // Milestone states
    const reachedFifties = new Set<string>();
    const reachedHundreds = new Set<string>();
    let partnershipRuns = 0;
    let bowlerConsecutiveWickets: Record<string, number> = {};

    for (let o = 1; o <= 20; o++) {
      if (totalWickets >= 10) break;
      if (targetToChase !== undefined && totalRuns >= targetToChase) break;

      const overNumber = o;
      let overRuns = 0;
      const overWicketsList: any[] = [];
      const overTimeline: any[] = [];

      const currentBowler = getBowlerForOver(o);
      // reset consecutive wickets if new bowler starts over
      if (!bowlerConsecutiveWickets[currentBowler.name]) {
        bowlerConsecutiveWickets[currentBowler.name] = 0;
      }

      for (let b = 1; b <= 6; b++) {
        if (totalWickets >= 10) break;
        if (targetToChase !== undefined && totalRuns >= targetToChase) break;

        const batsmanOnStrike = strikeIdx === 0 ? batsmen[bat1Idx] : batsmen[bat2Idx];
        if (!batsmanOnStrike) break;

        totalBallsBowled++;
        currentBowler.balls++;
        batsmanOnStrike.balls++;

        const r = Math.random();
        let ballCommentary = '';

        // Determine if it is final over (Over 20)
        const isFinalOver = (o === 20);

        if (r < 0.05) {
          // WICKET
          totalWickets++;
          currentBowler.wickets++;
          batsmanOnStrike.out = true;
          partnershipRuns = 0; // reset partnership

          // track consecutive wickets for bowler
          bowlerConsecutiveWickets[currentBowler.name] = (bowlerConsecutiveWickets[currentBowler.name] || 0) + 1;
          const isHatTrick = bowlerConsecutiveWickets[currentBowler.name] === 3;

          const fielders = bowlingPlayers.filter((p: any) => p.name !== currentBowler.name);
          const luckyFielder = fielders[Math.floor(Math.random() * fielders.length)]?.name || 'Fielder';
          
          let howOutStr = '';
          const wKind = Math.random();
          let isRunOut = false;
          if (wKind < 0.6) {
            howOutStr = `c ${luckyFielder} b ${currentBowler.name}`;
          } else if (wKind < 0.8) {
            howOutStr = `Bowled!`;
          } else if (wKind < 0.9) {
            howOutStr = `lbw b ${currentBowler.name}`;
          } else {
            howOutStr = `Run Out (${luckyFielder})`;
            isRunOut = true;
          }
          batsmanOnStrike.howOut = howOutStr;

          overWicketsList.push({
            player: batsmanOnStrike.name,
            howOut: howOutStr,
            bowler: currentBowler.name
          });

          // Commentary selection
          if (isHatTrick) {
            ballCommentary = `💥💥💥 HAT-TRICK GURU!!! ${currentBowler.name} registers 3 wickets in 3 balls! The crowd is absolutely losing their sanity! 😭🔥`;
          } else if (isRunOut) {
            ballCommentary = getUniqueComment(RUNOUT_POOL, usedRunOutIdx)
              .replace(/batsman/g, batsmanOnStrike.name)
              .replace(/fielder/g, luckyFielder)
              .replace(/keeper/g, 'keeper');
          } else {
            ballCommentary = getUniqueComment(WICKET_POOL, usedWicketIdx)
              .replace(/batsman/g, batsmanOnStrike.name)
              .replace(/Bumrah/g, currentBowler.name)
              .replace(/BCCI/g, 'Gully Desk')
              .replace(/Kohli/g, batsmanOnStrike.name)
              .replace(/Chahal/g, currentBowler.name);
          }

          overTimeline.push({
            ball: b,
            type: 'wicket',
            runsScored: 0,
            description: ballCommentary
          });

          if (nextBatIdx < batsmen.length) {
            if (strikeIdx === 0) {
              bat1Idx = nextBatIdx;
            } else {
              bat2Idx = nextBatIdx;
            }
            nextBatIdx++;
          } else {
            totalWickets = 10;
            break;
          }
        } else {
          // Not a wicket, reset bowler consecutive wickets
          bowlerConsecutiveWickets[currentBowler.name] = 0;

          if (r < 0.08) {
            // EXTRA
            totalRuns++;
            overRuns++;
            currentBowler.runs++;
            currentBowler.extras++;
            extrasCount++;
            partnershipRuns++;

            // Check final overs vs normal
            if (isFinalOver) {
              ballCommentary = getUniqueComment(FINALOVER_POOL, usedFinalOverIdx) + ` Extra run via Wide ball!`;
            } else {
              ballCommentary = `Extra Wide ball from ${currentBowler.name}. Extra run gifted silently.`;
            }

            overTimeline.push({
              ball: b,
              type: 'extra',
              runsScored: 1,
              description: ballCommentary
            });
          } else if (r < 0.18) {
            // SIX
            batsmanOnStrike.runs += 6;
            batsmanOnStrike.sixes++;
            currentBowler.runs += 6;
            totalRuns += 6;
            overRuns += 6;
            partnershipRuns += 6;

            // Check milestone and winning runs inside scoring
            const hasWon = (targetToChase !== undefined && totalRuns >= targetToChase);

            if (hasWon) {
              ballCommentary = `🏆🏆🏆 MATCH WINNING SIX GURU!!! ${batsmanOnStrike.name} hits maximum style over deep midwicket! ${battingTeam} have cleared the line in absolute style!`;
            } else if (batsmanOnStrike.runs >= 100 && !reachedHundreds.has(batsmanOnStrike.name)) {
              reachedHundreds.add(batsmanOnStrike.name);
              ballCommentary = `👑 HUNDRED FOR ${batsmanOnStrike.name}! What an absolute legend! High-speed century reached with a glorious, sky-high six! Bere level class!`;
            } else if (batsmanOnStrike.runs >= 50 && !reachedFifties.has(batsmanOnStrike.name)) {
              reachedFifties.add(batsmanOnStrike.name);
              ballCommentary = `🙌 FIFTY GURU!!! ${batsmanOnStrike.name} scores their half-century in magnificent style, sending that ball straight into the orbit! Elegant!`;
            } else if (partnershipRuns >= 100 && partnershipRuns - 6 < 100) {
              ballCommentary = `🤝 100-RUN PARTNERSHIP GURU! Brilliant coordination, fully setting the stadium on fire!`;
            } else if (partnershipRuns >= 50 && partnershipRuns - 6 < 50) {
              ballCommentary = `🤝 50-RUN PARTNERSHIP! Fine rebuilding work paying off nicely under pressure!`;
            } else if (isFinalOver) {
              ballCommentary = getUniqueComment(FINALOVER_POOL, usedFinalOverIdx) + ` SIX! Slammed beautifully into the second tier!`;
            } else {
              ballCommentary = getUniqueComment(SIX_POOL, usedSixIdx)
                .replace(/batsman/g, batsmanOnStrike.name)
                .replace(/bowler/g, currentBowler.name);
            }

            overTimeline.push({
              ball: b,
              type: 'boundary',
              runsScored: 6,
              description: ballCommentary
            });
          } else if (r < 0.30) {
            // FOUR
            batsmanOnStrike.runs += 4;
            batsmanOnStrike.fours++;
            currentBowler.runs += 4;
            totalRuns += 4;
            overRuns += 4;
            partnershipRuns += 4;

            const hasWon = (targetToChase !== undefined && totalRuns >= targetToChase);

            if (hasWon) {
              ballCommentary = `🏆🏆🏆 MATCH WINNING BOUNDARY!!! ${batsmanOnStrike.name} slices it past point for four! The dugout is running onto the field, what a win!`;
            } else if (batsmanOnStrike.runs >= 100 && !reachedHundreds.has(batsmanOnStrike.name)) {
              reachedHundreds.add(batsmanOnStrike.name);
              ballCommentary = `👑 SPECTACULAR HUNDRED! ${batsmanOnStrike.name} brings up their century with a classic cover drive to the rope! Bowler ge full answer-ey illa!`;
            } else if (batsmanOnStrike.runs >= 50 && !reachedFifties.has(batsmanOnStrike.name)) {
              reachedFifties.add(batsmanOnStrike.name);
              ballCommentary = `🙌 HALF-CENTURY GURU! Magnificent fifty for ${batsmanOnStrike.name}, driven cleanly through cover, pure elegance!`;
            } else if (partnershipRuns >= 100 && partnershipRuns - 4 < 100) {
              ballCommentary = `🤝 100-RUN PARTNERSHIP! Superb contribution from both batsmen, keeping the team sheet high!`;
            } else if (partnershipRuns >= 50 && partnershipRuns - 4 < 50) {
              ballCommentary = `🤝 50-RUN PARTNERSHIP! Fine teamwork under pressure!`;
            } else if (isFinalOver) {
              ballCommentary = getUniqueComment(FINALOVER_POOL, usedFinalOverIdx) + ` FOUR! Directed with pure expertise through third man!`;
            } else {
              ballCommentary = getUniqueComment(FOUR_POOL, usedFourIdx)
                .replace(/batsman/g, batsmanOnStrike.name)
                .replace(/bowler/g, currentBowler.name);
            }

            overTimeline.push({
              ball: b,
              type: 'boundary',
              runsScored: 4,
              description: ballCommentary
            });
          } else if (r < 0.65) {
            // RUNS (1, 2, 3)
            const runs = Math.random() < 0.82 ? 1 : Math.random() < 0.95 ? 2 : 3;
            batsmanOnStrike.runs += runs;
            currentBowler.runs += runs;
            totalRuns += runs;
            overRuns += runs;
            partnershipRuns += runs;

            const hasWon = (targetToChase !== undefined && totalRuns >= targetToChase);

            if (hasWon) {
              ballCommentary = `🏆🏆🏆 THEY HAVE DONE IT! ${batsmanOnStrike.name} completes the final runs, they have chased down the target under massive support! absolute high josh!`;
            } else if (batsmanOnStrike.runs >= 100 && !reachedHundreds.has(batsmanOnStrike.name)) {
              reachedHundreds.add(batsmanOnStrike.name);
              ballCommentary = `👑 HUNDRED! ${batsmanOnStrike.name} works it into deep space and brings up a sensational milestone! What a batsman!`;
            } else if (batsmanOnStrike.runs >= 50 && !reachedFifties.has(batsmanOnStrike.name)) {
              reachedFifties.add(batsmanOnStrike.name);
              ballCommentary = `🙌 FIFTY GURU! ${batsmanOnStrike.name} completes their half-century with steady running. Terrific knock!`;
            } else if (isFinalOver) {
              ballCommentary = getUniqueComment(FINALOVER_POOL, usedFinalOverIdx) + ` Runs Scored: ${runs}.`;
            } else {
              // SILENT SIMULATION: Pick a clean, short silent line
              let silentBase = "";
              if (runs === 1) {
                silentBase = silentSingleComments[Math.floor(Math.random() * silentSingleComments.length)];
              } else if (runs === 2) {
                silentBase = silentTwoComments[Math.floor(Math.random() * silentTwoComments.length)];
              } else {
                silentBase = "pushes it past mid-off, running hard to obtain three runs.";
              }
              ballCommentary = silentBase.replace(/\[Batsman\]/g, batsmanOnStrike.name);
            }

            overTimeline.push({
              ball: b,
              type: 'run',
              runsScored: runs,
              description: ballCommentary
            });

            if (runs % 2 === 1) {
              strikeIdx = strikeIdx === 0 ? 1 : 0;
            }
          } else {
            // DOT BALL
            const hasWon = (targetToChase !== undefined && totalRuns >= targetToChase);
            
            if (isFinalOver) {
              ballCommentary = getUniqueComment(FINALOVER_POOL, usedFinalOverIdx) + ` Dot ball! Valuable delivery under massive pressure!`;
            } else {
              // SILENT DOT
              const baseDot = silentDotComments[Math.floor(Math.random() * silentDotComments.length)];
              ballCommentary = baseDot.replace(/\[Batsman\]/g, batsmanOnStrike.name);
            }

            overTimeline.push({
              ball: b,
              type: 'dot',
              runsScored: 0,
              description: ballCommentary
            });
          }
        }
      }

      strikeIdx = strikeIdx === 0 ? 1 : 0;

      const overComments = [
        `Sharp bowling over there by ${currentBowler.name}. Kept the batsmen guessing!`,
        `Fabulous hits! Big over for the batting side pushing the score up.`,
        `Tense over! The stadium is completely buzzing under high pressure.`,
        `Sensational line of attack under pressure. Kept runs tight!`,
        `Absolute entertainment, guru! Crowd is dancing in the stands!`
      ];

      oversSimulated.push({
        overNumber,
        runs: overRuns,
        commentary: overComments[Math.floor(Math.random() * overComments.length)],
        wicketsList: overWicketsList,
        timeline: overTimeline
      });
    }

    const bowlersListOutput = Array.from(bowlerStatsMap.values()).map(b => {
      const overDecimal = Math.floor(b.balls / 6) + (b.balls % 6) / 10;
      return {
        name: b.name,
        overs: overDecimal,
        runs: b.runs,
        wickets: b.wickets,
        extras: b.extras
      };
    });

    const activeBatsmenStats = batsmen.filter(b => b.balls > 0 || b.runs > 0);
    const finalOversValue = Math.floor(totalBallsBowled / 6) + (totalBallsBowled % 6) / 10;

    return {
      battingTeam,
      bowlingTeam,
      totalRuns,
      totalWickets,
      totalOvers: finalOversValue,
      overs: oversSimulated,
      batsmen: activeBatsmenStats,
      bowlers: bowlersListOutput
    };
  };

  const innings1 = simulateInnings(firstBattingTeam, firstBowlingTeam, firstBattingPlayers, firstBowlingPlayers);

  const target = innings1.totalRuns + 1;
  const innings2 = simulateInnings(firstBowlingTeam, firstBattingTeam, firstBowlingPlayers, firstBattingPlayers, target);

  let winner = '';
  let margin = '';
  let superOverTriggered = false;

  if (innings2.totalRuns >= target) {
    winner = innings2.battingTeam;
    const wicketsLeft = 10 - innings2.totalWickets;
    margin = `${winner} won by ${wicketsLeft} wickets`;
  } else if (innings2.totalRuns < innings1.totalRuns) {
    winner = innings1.battingTeam;
    const runsMargin = innings1.totalRuns - innings2.totalRuns;
    margin = `${winner} won by ${runsMargin} runs`;
  } else {
    winner = innings1.battingTeam; // Choose default or super over victor
    margin = `${winner} won via exciting Super Over tie-breaker!`;
    superOverTriggered = true;
  }

  const winningPlayers = winner === teamAName ? teamAPlayers : teamBPlayers;
  const pomCandidate = winningPlayers[0] || { name: 'Player of team', role: 'Batsman' };
  
  const in1P = innings1.batsmen.find(b => b.name === pomCandidate.name);
  const in2P = innings2.batsmen.find(b => b.name === pomCandidate.name);
  const battingStats = in1P ? `${in1P.runs} off ${in1P.balls}` : (in2P ? `${in2P.runs} off ${in2P.balls}` : '36 runs off 14 balls');
  
  const playerOfTheMatch = {
    name: pomCandidate.name,
    reason: `Exceptional boundaries under extreme pressure, showing top class determination and bare level control!`,
    stats: battingStats
  };

  const gullyCommentary = `
🪙 Toss
Pitch is dry, hard and ready guru! Fully action-packed T20 match ready. Coin is up in the air... and won by ${tossWinner}! They elected to ${tossDecision} first! Entire stadium feels full josh!

⚡ Powerplay Summary
Ayyayooo! Opening overs were pure fireworks macha! ${innings1.battingTeam} stepped in with supreme intent. Bowler ge answer-ey illa ivattu! Opener slammed huge shots to start the innings with supreme josh!

🔄 Middle Overs Summary
Middle overs were absolute cinema guru! Spinners tried to control the speed, claiming a couple of lightning wickets 🚨. But batsmen backed their timing, finding boundaries perfectly. What an intense battle!

💥 Death Overs Summary
💥💥💥 Ultimate tension at the death overs! ${innings1.battingTeam} posted ${innings1.totalRuns}/${innings1.totalWickets}. Then ${innings2.battingTeam} walked in for a blistering chase, chasing ${target} runs in 120 balls! Boundary after boundary, the crowd went completely habba 🚀🔥!

🎯 Match Turning Points
🎯 Turning Point 1: Over 12 had back-to-back sixes that completely broke the bowling length!
🎯 Turning Point 2: Splendid catch in the deep under high pressure swung the momentum right before the finish!

🏆 Player Of The Match
🏆 ${playerOfTheMatch.name} - ${playerOfTheMatch.stats}
Yen innings guru 😭🔥 Completely destroyed the opponent's bowling plans with majestic coverage and Yen timing guru! Absolutely deserved.

🎤 Presentation Ceremony
Losing Captain: "Ayyayooo, we missed some crucial lines on our bowling and they punished us. But outstanding fight from our boys!"
Winning Captain: "Yen crowd guru! Fully backing us till the end. We kept our heads cool. This win is completely dedicated to our fans!"
Player of the Match: "Outstanding feeling macha! Just wanted to stay till the end and hit the loose ones. Bere level josh today!"
`;

  const presentationCommentary = `
Losing Captain: "We fought well but were a few runs short. Their batting was incredible."
Winning Captain: "Terrific team effort today. Everyone stayed calm and stuck to our game plans."
Player of the Match: "Extremely pleased with my contribution. Delighted we came out with the points today!"
`;

  return {
    toss: {
      winner: tossWinner,
      decision: tossDecision,
      commentary: tossCommentary
    },
    innings1,
    innings2,
    result: {
      winner,
      margin,
      summary: `${winner} claimed an exciting victory over ${winner === teamAName ? teamBName : teamAName} in a closely contested battle!`,
      playerOfTheMatch,
      presentationCommentary,
      gullyCommentary
    }
  };
}

function generateLocalNewsFallback(category: string, contextData: any): any {
  let title = '';
  let content = '';
  let summary = '';

  switch (category) {
    case 'Preview':
      title = `SENSATIONAL PREVIEW: ${contextData.teamA || 'Rivals'} and ${contextData.teamB || 'Opponents'} lock horns in T20 Battle!`;
      content = `The cricket arena is buzzing with excitement guru! We have ${contextData.teamA || 'Team A'} and ${contextData.teamB || 'Team B'} ready to face off in what is expected to be a high-josh blockbuster. Both camps look fully prepared.\n\nFans have travelled from far places to secure seats. The team sheets represent fine balance and absolute power hits from top to bottom.\n\nPitch reporters expect the team winning the toss to chase under fast dew conditions. Fast bowlers will look to secure early wickets to build vital pressure!`;
      summary = `A high-octane T20 encounter is on the horizon.`;
      break;
    case 'Review':
      title = `MATCH REVIEW: ${contextData.winner || 'Winners'} secure beautiful victory over ${contextData.teamB || 'opponents'}!`;
      content = `Pure entertainment, macha! The clash concluded with ${contextData.winner || 'winners'} clinching the trophy points in high dramatic style. Winning by ${contextData.margin || 'a tight margin'}, they have proven their championship calibre.\n\nThe game highlights are summarised as follows: ${contextData.summary || 'A stunning showcase of talent'}.\n\nCricket analysts applauded the death overs execution, noting it was the critical turning point that determined the outcome of this majestic contest!`;
      summary = `${contextData.winner || 'The victors'} continue their sensational winning run.`;
      break;
    case 'Spotlight':
      title = `PLAYER SPOTLIGHT: ${contextData.player || 'Selected Star'} makes headlines with bare level play!`;
      content = `The league is marveling at the incredible display by the superstar ${contextData.player || 'hero'}. Representing ${contextData.team || 'their group'} with extreme vigor, their rating of ${contextData.rating || '90+'} speaks bounds about their quality!\n\nWhether sending the ball into orbit or claiming crucial wickets, they keep showing why they are highly respected in the dressing room.\n\nFollowing the game, they commented: "Extremely glad to secure this performance for my squad. Pure josh today!"`;
      summary = `${contextData.player || 'The player'} receives the spotlight honors this week.`;
      break;
    default:
      title = `LEAGUE EXCLUSIVE: High pressure matches completely split the leaderboards!`;
      content = `The league stand is tighter than ever guru! With teams going head-to-head in rapid matches, standings switch after every single over. Champions are rising.\n\nCricket enthusiasts are loving the competitive nature. The point differences are incredibly narrow.\n\nStay tuned for more premium live updates as the championship races towards the high-stakes playoffs!`;
      summary = `The battle for championship qualification intensifies further.`;
  }

  return { title, content, summary };
}

// ----------------------------------------------------
// ENDPOINTS
// ----------------------------------------------------

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Match Simulation Endpoint (AI Cricket Engine)
app.post('/api/match/simulate', async (req, res) => {
  const {
    teamAName,
    teamBName,
    teamAPlayers,
    teamBPlayers,
    captainA,
    viceCaptainA,
    impactPlayerA,
    captainB,
    viceCaptainB,
    impactPlayerB
  } = req.body;

  try {
    if (!teamAName || !teamBName || !teamAPlayers || !teamBPlayers) {
      return res.status(400).json({ error: 'Missing mandatory team/roster information' });
    }

    const genAI = getGenAI();

    const prompt = `
Generate a highly realistic, thrilling, detailed ball-by-ball simulated 20-over (T20 format) cricket fixture between ${teamAName} and ${teamBName}.
You must simulate TWO complete innings of a highly responsive, action-packed 20-over match where:
- Team A (${teamAName}) has Captain ${captainA}, Vice-Captain ${viceCaptainA}, Impact Player: ${impactPlayerA || 'None'}. Roster: ${JSON.stringify(teamAPlayers)}.
- Team B (${teamBName}) has Captain ${captainB}, Vice-Captain ${viceCaptainB}, Impact Player: ${impactPlayerB || 'None'}. Roster: ${JSON.stringify(teamBPlayers)}.

Guidelines for the simulation:
0. OPTIMIZE FOR GENERATION SPEED: This is an interactive application, and generation speed is highly critical. Keep all ball descriptions, summaries, over commentaries, and presentation speech extremely short and crisp (maximum 1 quick sentence per value). Minimize generated text tokens as much as possible to ensure fast responses.
1. Conduct a pitch-side toss. Decide who wins the toss and what they choose to do based on standard cricketing intelligence (e.g. good dew factor, green pitch).
2. Simulate Innings 1 and Innings 2 ball-by-ball. Max 20 overs (120 balls) per innings. Ensure player stats are logically consistent:
   - When a player gets out, credit the proper bowler, specify 'howOut', and end their batting turn.
   - Individual batsman runs MUST sum to the innings total runs plus extras.
   - Individual bowler wickets, overs faced, and runs conceded MUST match the total score.
   - Total overs should stop immediately if the second innings target is successfully chased (wins by wickets) or if the batting team is bowled out (loses 10 wickets) or if the 20 overs are complete.
3. The match should feel realistic (e.g. key stars with higher ratings have higher strike rates or lower economy, bowlers face pressure in the death overs, tailenders face issues scoring).
4. Do NOT write verbose custom/slang commentary for standard/mundane dot balls or simple runs (0, 1, 2, or 3 runs). For these ordinary/silent balls, keep the "description" extremely short, simple, and silent (e.g. "Rahul works it for a single.", "Dot ball. Defended back to bowler.", "Dropped into cover for a run.").
   Only write detailed, exciting, high-josh gully-style comments for IMPORTANT moments: Fours, Sixes, Wickets, Run Outs, Half-Centuries, Centuries, Hat Tricks, Partnership Milestones, the Final Over, or Match-Winning Moments.
5. Identify a logical "Player of the Match" from the winning team based on their exceptional numerical performance in batting, bowling, or both, and generate short commentary of the Post-Match Presentation Ceremony.
6. Generate a dedicated match narrative in the "gullyCommentary" field before showing the scorecard, following the "Karnataka Gully Commentary" style:
   - Language: English mixed with Kannada slang written in English (guru, macha, ayyayooo, yen shot guru, bere level, absolute cinema, bowler ge answer illa, ivattu form bere level, full josh, crowd ge habba, yen timing guru).
   - Tone: Emotional, exciting, friendly, and fun. Use slang naturally and don't overuse it to keep it readable.
   - Balance: 80% Professional Cricket Commentary, 20% Kannada-English Hype Reactions.
   - Extreme hype/reactions (with emojis like 🔥, 🚨, 😱, 🏆, 😭, 🎯, 🚀) are reserved for key events such as fours, sixes, wickets, half centuries, final overs, match-winning moments, and trophy moments.
   - The "gullyCommentary" field must have exactly this structured layout (using clear markdown headers and emojis):
     
     🪙 Toss
     (Describe the pitch, the coin toss, who won and what they chose in Gully style!)
     
     ⚡ Powerplay Summary
     (Summarize the first 6 overs action in Gully style)
     
     🔄 Middle Overs Summary
     (Summarize overs 7-15 action in Gully style)
     
     💥 Death Overs Summary
     (Summarize the final over (Over 20) action or final over climax in Gully style)
     
     🎯 Match Turning Points
     (Highlight 1-2 key moments that swung the game in Gully style)
     
     🏆 Player Of The Match
     (Present the Player of the Match and stats line in Gully style)
     
     🎤 Presentation Ceremony
     (Detail the comments, captain quotes of both teams, and high-josh responses in Gully style!)

Generate ONLY valid JSON matching the requested structure.
`;

    const response = await withTimeout(
      genAI.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: matchResponseSchema,
          temperature: 1.0, // High temperature for unpredictable, historic cricket matches!
        }
      }),
      15000,
      'Gemini API request timed out after 15 seconds'
    );

    const outputText = response.text;
    if (!outputText) {
      throw new Error('Gemini returned an empty response');
    }

    const matchData = JSON.parse(outputText);
    res.json(matchData);
  } catch (error: any) {
    console.warn('Gemini Match Simulation error. Activating premium local fallback model:', error?.message || error);
    try {
      const fallbackData = simulateLocalMatchFallback(
        teamAName,
        teamBName,
        teamAPlayers,
        teamBPlayers,
        captainA,
        viceCaptainA,
        impactPlayerA,
        captainB,
        viceCaptainB,
        impactPlayerB
      );
      res.json(fallbackData);
    } catch (fallbackError: any) {
      console.error('Critical fallback simulation failure:', fallbackError);
      res.status(500).json({ error: error.message || 'Failed to simulate cricket match' });
    }
  }
});

// AI Newsroom Generator Endpoint
app.post('/api/news/generate', async (req, res) => {
  const { category, contextData } = req.body;

  try {
    if (!category || !contextData) {
      return res.status(400).json({ error: 'News category and context details are required' });
    }

    const genAI = getGenAI();

    let categoryPrompt = '';
    switch (category) {
      case 'Preview':
        categoryPrompt = `Write an exciting Match Preview article for an upcoming clash between: ${contextData.teamA} and ${contextData.teamB}. Include strengths, tactical threats, head-to-head spark, pitch report, and key player focus.`;
        break;
      case 'Review':
        categoryPrompt = `Write a comprehensive, engaging Post-Match Review of the match between ${contextData.teamA} and ${contextData.teamB}. Winner of the clash was ${contextData.winner} by ${contextData.margin}. The scorecard summary was: ${contextData.summary}. Highlight the defining turning point of the game and add a crowd-reaction paragraph.`;
        break;
      case 'Spotlight':
        categoryPrompt = `Write a Player Spotlight article focusing on the outstanding performance of ${contextData.player}. They perform for ${contextData.team}. Explain how they made headlines, their background star power, rating: ${contextData.rating}, and their interview response after the match.`;
        break;
      case 'Summary':
        categoryPrompt = `Write a League Mid-Season / Season-End review article summarizing the current points table standings and star performances. Standings: ${JSON.stringify(contextData.standings)}. Highlight champion vibes, underdogs fighting back, and orange/purple cap leaders.`;
        break;
      case 'Breaking':
        categoryPrompt = `Write a highly sensational Cricbuzz-style Breaking News article of a massive development in the league. Context: ${contextData.story}. Make it feel urgent and trendy!`;
        break;
      default:
        categoryPrompt = `Write an editorial cricketing article summarizing the draft results or lock status. Context: ${JSON.stringify(contextData)}`;
    }

    const prompt = `
You are a lead senior sports editor for the AI Cricket League Newsroom.
Write a thrilling, high-quality sports news article in English that sounds exactly like a leading cricket website (e.g. ESPN Cricinfo, Cricbuzz).
${categoryPrompt}

Structure instructions:
Return a JSON object containing:
- title: A catchy, newspaper-style headline (string)
- content: A rich, styled article content (string with 3-4 paragraphs separated by newlines)
- summary: A single-sentence scroll-ticker highlight.

Generate ONLY valid JSON matching this schema:
{
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "content": { "type": "string" },
    "summary": { "type": "string" }
  },
  "required": ["title", "content", "summary"]
}
`;

    const response = await genAI.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            summary: { type: Type.STRING }
          },
          required: ['title', 'content', 'summary']
        }
      }
    });

    const outputText = response.text;
    if (!outputText) {
      throw new Error('Gemini API returned empty text');
    }

    const articleData = JSON.parse(outputText);
    res.json(articleData);
  } catch (error: any) {
    console.warn('Gemini Newsroom error. Activating premium local fallback model:', error?.message || error);
    try {
      const fallbackNews = generateLocalNewsFallback(category, contextData);
      res.json(fallbackNews);
    } catch (fallbackError: any) {
      console.error('Critical news fallback failure:', fallbackError);
      res.status(500).json({ error: error.message || 'Failed to generate news headline' });
    }
  }
});

// ----------------------------------------------------
// VITE INTEGRATION / STATIC SERVING
// ----------------------------------------------------

async function setupAppServer() {
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  // Determine production based on environment variables, bundle structure, or presence of dist folder
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    currentFilePath.includes('server.cjs') ||
    currentFilePath.includes('dist') ||
    (hasDist && process.env.NODE_ENV !== 'development');

  if (!isProduction) {
    // Development Mode: Mount Vite middleware
    console.log('Starting server in DEVELOPMENT mode...');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Mounted active dev Vite middleware.');
  } else {
    // Production Mode: Serve static folder
    console.log('Starting server in PRODUCTION mode...');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Serving production-ready static assets from:', distPath);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Cricket League app running at http://localhost:${PORT}`);
  });
}

setupAppServer();
