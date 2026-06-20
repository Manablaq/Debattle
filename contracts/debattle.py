# v0.1.0
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from dataclasses import dataclass
import json

# ─────────────────────────────────────────────────────────────────────
#  CONSTANTS
# ─────────────────────────────────────────────────────────────────────

STARTING_POINTS    = 50
MIN_STAKE          = 5
MAX_STAKE          = 500
APPEAL_COST        = 10   # points burned to file an appeal

DEBATE_OPEN        = "OPEN"        # waiting for opponent
DEBATE_ACTIVE      = "ACTIVE"      # both joined, waiting for arguments
DEBATE_JUDGING     = "JUDGING"     # arguments submitted, awaiting verdict
DEBATE_FINISHED    = "FINISHED"    # verdict issued, winner can claim
DEBATE_CLAIMED     = "CLAIMED"     # winner claimed points
DEBATE_DISPUTED    = "DISPUTED"    # appeal filed
DEBATE_FINAL       = "FINAL"       # appeal resolved, truly over
DEBATE_CANCELLED   = "CANCELLED"   # creator cancelled before opponent joined

ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"


# ─────────────────────────────────────────────────────────────────────
#  STORAGE DATACLASSES
# ─────────────────────────────────────────────────────────────────────

@allow_storage
@dataclass
class Player:
    address: str
    username: str
    points: str          # current point balance
    wins: str
    losses: str
    draws: str
    win_streak: str
    best_streak: str
    total_debates: str
    points_earned: str   # lifetime points earned
    points_lost: str     # lifetime points lost
    registered: str      # "true" / "false"


@allow_storage
@dataclass
class Debate:
    debate_id: str
    creator: str
    opponent: str
    topic: str
    stake: str           # points each player staked
    status: str
    creator_argument: str
    opponent_argument: str
    creator_score: str
    opponent_score: str
    winner: str          # address of winner or "DRAW"
    reasoning: str       # AI reasoning for the verdict
    creator_score_breakdown: str
    opponent_score_breakdown: str
    appeal_grounds: str
    appeal_verdict: str  # "UPHELD" / "OVERTURNED"
    appeal_reasoning: str
    claimed: str         # "true" / "false"
    created_at: str
    category: str        # topic category for leaderboard


# ─────────────────────────────────────────────────────────────────────
#  CONTRACT
# ─────────────────────────────────────────────────────────────────────

class DeBattle(gl.Contract):
    players: TreeMap[str, str]
    debates: TreeMap[str, str]
    debate_ids: DynArray[str]
    player_addresses: DynArray[str]
    debate_counter: str
    total_points_in_circulation: str
    owner: str

    def __init__(self) -> None:
        self.debate_counter = "0"
        self.total_points_in_circulation = "0"
        self.owner = str(gl.message.sender_address)

    # ── ID helpers ────────────────────────────────────────────────────

    def _next_debate_id(self) -> str:
        n = int(self.debate_counter) + 1
        self.debate_counter = str(n)
        return str(n)

    # ── Serialization ─────────────────────────────────────────────────

    def _player_from_json(self, raw: str) -> Player:
        d = json.loads(raw)
        return Player(
            address=str(d["address"]),
            username=str(d.get("username", "")),
            points=str(d.get("points", str(STARTING_POINTS))),
            wins=str(d.get("wins", "0")),
            losses=str(d.get("losses", "0")),
            draws=str(d.get("draws", "0")),
            win_streak=str(d.get("win_streak", "0")),
            best_streak=str(d.get("best_streak", "0")),
            total_debates=str(d.get("total_debates", "0")),
            points_earned=str(d.get("points_earned", "0")),
            points_lost=str(d.get("points_lost", "0")),
            registered=str(d.get("registered", "false")),
        )

    def _player_to_json(self, p: Player) -> str:
        return json.dumps({
            "address": p.address, "username": p.username,
            "points": p.points, "wins": p.wins, "losses": p.losses,
            "draws": p.draws, "win_streak": p.win_streak,
            "best_streak": p.best_streak, "total_debates": p.total_debates,
            "points_earned": p.points_earned, "points_lost": p.points_lost,
            "registered": p.registered,
        }, sort_keys=True)

    def _debate_from_json(self, raw: str) -> Debate:
        d = json.loads(raw)
        return Debate(
            debate_id=str(d["debate_id"]),
            creator=str(d["creator"]),
            opponent=str(d.get("opponent", ZERO_ADDRESS)),
            topic=str(d["topic"]),
            stake=str(d["stake"]),
            status=str(d["status"]),
            creator_argument=str(d.get("creator_argument", "")),
            opponent_argument=str(d.get("opponent_argument", "")),
            creator_score=str(d.get("creator_score", "")),
            opponent_score=str(d.get("opponent_score", "")),
            winner=str(d.get("winner", "")),
            reasoning=str(d.get("reasoning", "")),
            creator_score_breakdown=str(d.get("creator_score_breakdown", "")),
            opponent_score_breakdown=str(d.get("opponent_score_breakdown", "")),
            appeal_grounds=str(d.get("appeal_grounds", "")),
            appeal_verdict=str(d.get("appeal_verdict", "")),
            appeal_reasoning=str(d.get("appeal_reasoning", "")),
            claimed=str(d.get("claimed", "false")),
            created_at=str(d.get("created_at", "0")),
            category=str(d.get("category", "General")),
        )

    def _debate_to_json(self, debate: Debate) -> str:
        return json.dumps({
            "debate_id": debate.debate_id, "creator": debate.creator,
            "opponent": debate.opponent, "topic": debate.topic,
            "stake": debate.stake, "status": debate.status,
            "creator_argument": debate.creator_argument,
            "opponent_argument": debate.opponent_argument,
            "creator_score": debate.creator_score,
            "opponent_score": debate.opponent_score,
            "winner": debate.winner, "reasoning": debate.reasoning,
            "creator_score_breakdown": debate.creator_score_breakdown,
            "opponent_score_breakdown": debate.opponent_score_breakdown,
            "appeal_grounds": debate.appeal_grounds,
            "appeal_verdict": debate.appeal_verdict,
            "appeal_reasoning": debate.appeal_reasoning,
            "claimed": debate.claimed, "created_at": debate.created_at,
            "category": debate.category,
        }, sort_keys=True)

    def _get_player(self, addr: str) -> Player:
        raw = self.players.get(addr, None)
        if raw is None:
            return Player(address=addr, username="", points=str(STARTING_POINTS),
                          wins="0", losses="0", draws="0", win_streak="0",
                          best_streak="0", total_debates="0", points_earned="0",
                          points_lost="0", registered="false")
        return self._player_from_json(raw)

    def _save_player(self, p: Player) -> None:
        self.players[p.address] = self._player_to_json(p)

    def _ensure_registered(self, addr: str) -> Player:
        """Get or auto-create player with 50 starting points."""
        raw = self.players.get(addr, None)
        if raw is None:
            p = Player(address=addr, username="", points=str(STARTING_POINTS),
                       wins="0", losses="0", draws="0", win_streak="0",
                       best_streak="0", total_debates="0", points_earned="0",
                       points_lost="0", registered="true")
            self._save_player(p)
            self.player_addresses.append(addr)
            circ = int(self.total_points_in_circulation) + STARTING_POINTS
            self.total_points_in_circulation = str(circ)
            return p
        return self._player_from_json(raw)

    # ════════════════════════════════════════════════════════════════
    #  WRITE 1 — register
    # ════════════════════════════════════════════════════════════════

    @gl.public.write
    def register(self, username: str) -> str:
        """
        Register a new player. Auto-grants 50 starting points.
        If already registered, updates username only.
        Returns current point balance.
        """
        caller = str(gl.message.sender_address)
        p = self._ensure_registered(caller)

        if username and len(username.strip()) > 0:
            clean = username.strip()[:20]  # max 20 chars
            p.username = clean

        p.registered = "true"
        self._save_player(p)
        return p.points

    # ════════════════════════════════════════════════════════════════
    #  WRITE 2 — create_debate
    #  AI Call 1: Topic validation
    # ════════════════════════════════════════════════════════════════

    @gl.public.write
    def create_debate(self, topic: str, stake: str, category: str) -> str:
        """
        Create a debate. Stakes points immediately.
        AI validates the topic is fair, specific, and debatable.
        Returns debate ID.
        """
        caller = str(gl.message.sender_address)
        p = self._ensure_registered(caller)

        stake_int = int(stake)
        if stake_int < MIN_STAKE:
            raise Exception(f"Minimum stake is {MIN_STAKE} points")
        if stake_int > MAX_STAKE:
            raise Exception(f"Maximum stake is {MAX_STAKE} points")
        if int(p.points) < stake_int:
            raise Exception(f"Insufficient points. You have {p.points}, need {stake}")

        # AI validates topic
        prompt = f"""Evaluate this debate topic for a competitive debate game.
Topic: {topic}
Category: {category}

Is this topic:
1. Clearly debatable (has two reasonable opposing sides)?
2. Specific enough to argue meaningfully?
3. Not offensive, harmful, or illegal?
4. Fair to both sides?

Respond ONLY with JSON:
{{"valid": true or false, "reason": "<one sentence>", "suggested_reframe": "<optional improvement if invalid>"}}"""

        def leader_fn():
            return json.dumps(gl.nondet.exec_prompt(prompt, response_format="json"), sort_keys=True)

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return): return False
            try:
                ld = json.loads(leaders_res.calldata)
                md = json.loads(leader_fn())
                return ld.get("valid") == md.get("valid")
            except Exception: return False

        ai = json.loads(gl.vm.run_nondet_unsafe(leader_fn, validator_fn))
        if not ai.get("valid", True):
            raise Exception(f"Topic rejected: {ai.get('reason', 'Not debatable')}. Suggestion: {ai.get('suggested_reframe', '')}")

        # Deduct stake
        p.points = str(int(p.points) - stake_int)
        self._save_player(p)

        debate_id = self._next_debate_id()
        debate = Debate(
            debate_id=debate_id, creator=caller,
            opponent=ZERO_ADDRESS, topic=topic,
            stake=stake, status=DEBATE_OPEN,
            creator_argument="", opponent_argument="",
            creator_score="", opponent_score="",
            winner="", reasoning="",
            creator_score_breakdown="", opponent_score_breakdown="",
            appeal_grounds="", appeal_verdict="", appeal_reasoning="",
            claimed="false", created_at="0", category=category,
        )
        self.debates[debate_id] = self._debate_to_json(debate)
        self.debate_ids.append(debate_id)
        return debate_id

    # ════════════════════════════════════════════════════════════════
    #  WRITE 3 — join_debate
    # ════════════════════════════════════════════════════════════════

    @gl.public.write
    def join_debate(self, debate_id: str) -> None:
        """
        Join an open debate. Must match the creator's stake.
        """
        caller = str(gl.message.sender_address)
        p = self._ensure_registered(caller)

        raw = self.debates.get(debate_id, None)
        if raw is None: raise Exception("Debate not found")
        debate = self._debate_from_json(raw)

        if debate.status != DEBATE_OPEN:
            raise Exception("Debate is not open for joining")
        if debate.creator == caller:
            raise Exception("You cannot join your own debate")

        stake_int = int(debate.stake)
        if int(p.points) < stake_int:
            raise Exception(f"Insufficient points. Need {debate.stake}, you have {p.points}")

        p.points = str(int(p.points) - stake_int)
        self._save_player(p)

        debate.opponent = caller
        debate.status = DEBATE_ACTIVE
        self.debates[debate_id] = self._debate_to_json(debate)

    # ════════════════════════════════════════════════════════════════
    #  WRITE 4 — submit_argument
    # ════════════════════════════════════════════════════════════════

    @gl.public.write
    def submit_argument(self, debate_id: str, argument: str) -> None:
        """
        Submit your argument for the debate.
        When both arguments are in, judging begins automatically.
        AI Call 2: Judge debate when both arguments submitted.
        """
        caller = str(gl.message.sender_address)
        raw = self.debates.get(debate_id, None)
        if raw is None: raise Exception("Debate not found")
        debate = self._debate_from_json(raw)

        if debate.status != DEBATE_ACTIVE:
            raise Exception("Debate is not active")
        if caller != debate.creator and caller != debate.opponent:
            raise Exception("You are not a participant in this debate")
        if not argument or len(argument.strip()) < 20:
            raise Exception("Argument too short — minimum 20 characters")

        is_creator = caller == debate.creator

        if is_creator:
            if debate.creator_argument:
                raise Exception("You already submitted your argument")
            debate.creator_argument = argument
        else:
            if debate.opponent_argument:
                raise Exception("You already submitted your argument")
            debate.opponent_argument = argument

        # If both arguments submitted — judge immediately
        if debate.creator_argument and debate.opponent_argument:
            debate.status = DEBATE_JUDGING
            self.debates[debate_id] = self._debate_to_json(debate)
            self._judge_debate(debate_id)
        else:
            self.debates[debate_id] = self._debate_to_json(debate)

    def _judge_debate(self, debate_id: str) -> None:
        """Internal — called automatically when both arguments are in."""
        raw = self.debates.get(debate_id, None)
        if raw is None: return
        debate = self._debate_from_json(raw)

        prompt = f"""You are an impartial debate judge. Score two arguments on the same topic.

TOPIC: {debate.topic}

PLAYER 1 (Creator) ARGUMENT:
{debate.creator_argument}

PLAYER 2 (Opponent) ARGUMENT:
{debate.opponent_argument}

Score each argument independently on:
- Logic & reasoning (35 pts): Are claims logical and well-structured?
- Evidence & examples (25 pts): Are claims supported with evidence or examples?
- Persuasiveness (25 pts): Is the argument compelling and convincing?
- Clarity & delivery (15 pts): Is the argument clear and well-written?

Total score out of 100 for each player.
If scores are within 5 points, declare a DRAW.

Respond ONLY with JSON:
{{"player1_score": <0-100>, "player2_score": <0-100>, "winner": "PLAYER1" or "PLAYER2" or "DRAW", "reasoning": "<3-4 sentence explanation of your decision>", "player1_breakdown": "<specific feedback on player 1's argument>", "player2_breakdown": "<specific feedback on player 2's argument>"}}"""

        def leader_fn():
            return json.dumps(gl.nondet.exec_prompt(prompt, response_format="json"), sort_keys=True)

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return): return False
            my_result = leader_fn()
            try:
                ld = json.loads(leaders_res.calldata)
                md = json.loads(my_result)
                lw = ld.get("winner", "")
                mw = md.get("winner", "")
                # Must agree on winner or both within 10 pts
                if lw == mw: return True
                lp1 = int(ld.get("player1_score", 0))
                lp2 = int(ld.get("player2_score", 0))
                mp1 = int(md.get("player1_score", 0))
                mp2 = int(md.get("player2_score", 0))
                return abs(lp1 - mp1) <= 10 and abs(lp2 - mp2) <= 10
            except Exception: return False

        ai = json.loads(gl.vm.run_nondet_unsafe(leader_fn, validator_fn))

        p1_score = str(ai.get("player1_score", 50))
        p2_score = str(ai.get("player2_score", 50))
        ai_winner = ai.get("winner", "DRAW")
        reasoning = str(ai.get("reasoning", ""))
        p1_breakdown = str(ai.get("player1_breakdown", ""))
        p2_breakdown = str(ai.get("player2_breakdown", ""))

        if ai_winner == "PLAYER1":
            winner_addr = debate.creator
        elif ai_winner == "PLAYER2":
            winner_addr = debate.opponent
        else:
            winner_addr = "DRAW"

        debate.creator_score = p1_score
        debate.opponent_score = p2_score
        debate.winner = winner_addr
        debate.reasoning = reasoning
        debate.creator_score_breakdown = p1_breakdown
        debate.opponent_score_breakdown = p2_breakdown
        debate.status = DEBATE_FINISHED
        self.debates[debate_id] = self._debate_to_json(debate)

        # Update stats (not points yet — winner must claim)
        stake_int = int(debate.stake)
        creator = self._get_player(debate.creator)
        opponent = self._get_player(debate.opponent)

        creator.total_debates = str(int(creator.total_debates) + 1)
        opponent.total_debates = str(int(opponent.total_debates) + 1)

        if winner_addr == "DRAW":
            # Draw — both get their stake back (no claim needed)
            creator.points = str(int(creator.points) + stake_int)
            creator.draws = str(int(creator.draws) + 1)
            creator.win_streak = "0"
            opponent.points = str(int(opponent.points) + stake_int)
            opponent.draws = str(int(opponent.draws) + 1)
            opponent.win_streak = "0"
            debate.claimed = "true"  # auto-claimed on draw
            self.debates[debate_id] = self._debate_to_json(debate)
        elif winner_addr == debate.creator:
            creator.wins = str(int(creator.wins) + 1)
            creator.win_streak = str(int(creator.win_streak) + 1)
            if int(creator.win_streak) > int(creator.best_streak):
                creator.best_streak = creator.win_streak
            opponent.losses = str(int(opponent.losses) + 1)
            opponent.win_streak = "0"
            opponent.points_lost = str(int(opponent.points_lost) + stake_int)
        else:
            opponent.wins = str(int(opponent.wins) + 1)
            opponent.win_streak = str(int(opponent.win_streak) + 1)
            if int(opponent.win_streak) > int(opponent.best_streak):
                opponent.best_streak = opponent.win_streak
            creator.losses = str(int(creator.losses) + 1)
            creator.win_streak = "0"
            creator.points_lost = str(int(creator.points_lost) + stake_int)

        self._save_player(creator)
        self._save_player(opponent)

    # ════════════════════════════════════════════════════════════════
    #  WRITE 5 — claim_winnings
    # ════════════════════════════════════════════════════════════════

    @gl.public.write
    def claim_winnings(self, debate_id: str) -> str:
        """
        Winner claims their points (stake x2).
        Only the winner can call this. Returns new point balance.
        """
        caller = str(gl.message.sender_address)
        raw = self.debates.get(debate_id, None)
        if raw is None: raise Exception("Debate not found")
        debate = self._debate_from_json(raw)

        if debate.status != DEBATE_FINISHED:
            raise Exception("Debate is not finished")
        if debate.claimed == "true":
            raise Exception("Winnings already claimed")
        if debate.winner == "DRAW":
            raise Exception("No winnings to claim — it was a draw")
        if debate.winner != caller:
            raise Exception("Only the winner can claim winnings")

        stake_int = int(debate.stake)
        winnings = stake_int * 2  # winner takes both stakes

        p = self._get_player(caller)
        p.points = str(int(p.points) + winnings)
        p.points_earned = str(int(p.points_earned) + winnings)
        self._save_player(p)

        debate.claimed = "true"
        debate.status = DEBATE_CLAIMED
        self.debates[debate_id] = self._debate_to_json(debate)

        return p.points

    # ════════════════════════════════════════════════════════════════
    #  WRITE 6 — cancel_debate
    # ════════════════════════════════════════════════════════════════

    @gl.public.write
    def cancel_debate(self, debate_id: str) -> None:
        """
        Creator cancels an OPEN debate before anyone joins.
        Stake is refunded.
        """
        caller = str(gl.message.sender_address)
        raw = self.debates.get(debate_id, None)
        if raw is None: raise Exception("Debate not found")
        debate = self._debate_from_json(raw)

        if debate.creator != caller:
            raise Exception("Only the creator can cancel")
        if debate.status != DEBATE_OPEN:
            raise Exception("Can only cancel open debates")

        # Refund stake
        p = self._get_player(caller)
        p.points = str(int(p.points) + int(debate.stake))
        self._save_player(p)

        debate.status = DEBATE_CANCELLED
        self.debates[debate_id] = self._debate_to_json(debate)

    # ════════════════════════════════════════════════════════════════
    #  WRITE 7 — appeal_verdict
    #  AI Call 3: Review appeal
    # ════════════════════════════════════════════════════════════════

    @gl.public.write
    def appeal_verdict(self, debate_id: str, grounds: str) -> None:
        """
        Losing player appeals the verdict. Costs APPEAL_COST points.
        AI reviews appeal under strict standard.
        """
        caller = str(gl.message.sender_address)
        raw = self.debates.get(debate_id, None)
        if raw is None: raise Exception("Debate not found")
        debate = self._debate_from_json(raw)

        if debate.status != DEBATE_FINISHED:
            raise Exception("Can only appeal a finished debate")
        if debate.winner == "DRAW":
            raise Exception("Cannot appeal a draw")
        if caller != debate.creator and caller != debate.opponent:
            raise Exception("Only participants can appeal")
        if caller == debate.winner:
            raise Exception("Winners cannot appeal")
        if debate.appeal_grounds:
            raise Exception("Appeal already filed")

        p = self._get_player(caller)
        if int(p.points) < APPEAL_COST:
            raise Exception(f"Appeal costs {APPEAL_COST} points. You have {p.points}")

        p.points = str(int(p.points) - APPEAL_COST)
        self._save_player(p)

        prompt = f"""Review this debate verdict appeal. Strict standard — overturn only on clear judging error.

TOPIC: {debate.topic}

PLAYER 1 ARGUMENT:
{debate.creator_argument}

PLAYER 2 ARGUMENT:
{debate.opponent_argument}

ORIGINAL VERDICT: {'Player 1' if debate.winner == debate.creator else 'Player 2'} won
Original scores: Player 1 = {debate.creator_score}/100, Player 2 = {debate.opponent_score}/100
Original reasoning: {debate.reasoning}

APPEAL GROUNDS: {grounds}

Should the verdict be overturned? Only overturn if the original judgment contains a clear factual error or grossly misrepresented one of the arguments.

Respond ONLY with JSON:
{{"upheld": true or false, "appeal_verdict": "UPHELD" or "OVERTURNED", "reasoning": "<2-3 sentences>", "new_winner": "PLAYER1" or "PLAYER2" or "DRAW"}}"""

        def leader_fn():
            return json.dumps(gl.nondet.exec_prompt(prompt, response_format="json"), sort_keys=True)

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return): return False
            try:
                ld = json.loads(leaders_res.calldata)
                md = json.loads(leader_fn())
                return ld.get("appeal_verdict") == md.get("appeal_verdict")
            except Exception: return False

        ai = json.loads(gl.vm.run_nondet_unsafe(leader_fn, validator_fn))

        appeal_result = str(ai.get("appeal_verdict", "UPHELD"))
        appeal_reasoning = str(ai.get("reasoning", ""))
        debate.appeal_grounds = grounds
        debate.appeal_verdict = appeal_result
        debate.appeal_reasoning = appeal_reasoning

        if appeal_result == "OVERTURNED":
            new_winner_str = ai.get("new_winner", "DRAW")
            if new_winner_str == "PLAYER1":
                new_winner = debate.creator
            elif new_winner_str == "PLAYER2":
                new_winner = debate.opponent
            else:
                new_winner = "DRAW"

            old_winner = debate.winner
            debate.winner = new_winner
            debate.status = DEBATE_FINAL
            debate.claimed = "false"  # reset — new winner can now claim

            # Reverse old win/loss records
            old_w = self._get_player(old_winner)
            old_l = self._get_player(debate.creator if old_winner == debate.opponent else debate.opponent)
            old_w.wins = str(max(0, int(old_w.wins) - 1))
            old_w.losses = str(int(old_w.losses) + 1)
            old_l.losses = str(max(0, int(old_l.losses) - 1))
            old_l.wins = str(int(old_l.wins) + 1)
            self._save_player(old_w)
            self._save_player(old_l)
        else:
            debate.status = DEBATE_FINAL

        self.debates[debate_id] = self._debate_to_json(debate)

    # ════════════════════════════════════════════════════════════════
    #  READ METHODS
    # ════════════════════════════════════════════════════════════════

    @gl.public.view
    def get_player(self, address: str) -> str:
        raw = self.players.get(address, None)
        if raw is None:
            # Return default unregistered player
            return json.dumps({
                "address": address, "username": "", "points": str(STARTING_POINTS),
                "wins": "0", "losses": "0", "draws": "0", "win_streak": "0",
                "best_streak": "0", "total_debates": "0", "points_earned": "0",
                "points_lost": "0", "registered": "false",
            })
        return raw

    @gl.public.view
    def get_debate(self, debate_id: str) -> str:
        raw = self.debates.get(debate_id, None)
        return raw if raw is not None else json.dumps({"error": "Debate not found"})

    @gl.public.view
    def get_debate_for_participant(self, debate_id: str, viewer: str) -> str:
        """Returns full debate including arguments — only for participants."""
        raw = self.debates.get(debate_id, None)
        if raw is None: return json.dumps({"error": "Debate not found"})
        d = json.loads(raw)
        if viewer == d.get("creator") or viewer == d.get("opponent"):
            return raw
        # Mask arguments from non-participants until debate is finished
        if d.get("status") in [DEBATE_ACTIVE, DEBATE_JUDGING]:
            d["creator_argument"] = ""
            d["opponent_argument"] = ""
        return json.dumps(d, sort_keys=True)

    @gl.public.view
    def get_all_debates(self) -> str:
        result = []
        for did in self.debate_ids:
            raw = self.debates.get(did, None)
            if raw is not None:
                d = json.loads(raw)
                # Mask arguments for active debates in public view
                if d.get("status") in [DEBATE_ACTIVE, DEBATE_JUDGING]:
                    d["creator_argument"] = ""
                    d["opponent_argument"] = ""
                result.append(d)
        return json.dumps(result)

    @gl.public.view
    def get_leaderboard(self) -> str:
        players = []
        for addr in self.player_addresses:
            raw = self.players.get(addr, None)
            if raw is not None:
                players.append(json.loads(raw))
        # Sort by wins desc, then points desc
        players.sort(key=lambda x: (-int(x.get("wins", 0)), -int(x.get("points", 0))))
        return json.dumps(players[:20])  # top 20

    @gl.public.view
    def get_open_debates(self) -> str:
        result = []
        for did in self.debate_ids:
            raw = self.debates.get(did, None)
            if raw is not None:
                d = json.loads(raw)
                if d.get("status") == DEBATE_OPEN:
                    result.append(d)
        return json.dumps(result)

    @gl.public.view
    def get_platform_stats(self) -> str:
        total = int(self.debate_counter)
        open_d = active = finished = claimed = 0
        for did in self.debate_ids:
            raw = self.debates.get(did, None)
            if raw is not None:
                s = json.loads(raw).get("status", "")
                if s == DEBATE_OPEN: open_d += 1
                elif s == DEBATE_ACTIVE: active += 1
                elif s == DEBATE_FINISHED: finished += 1
                elif s in [DEBATE_CLAIMED, DEBATE_FINAL]: claimed += 1
        return json.dumps({
            "total_debates": str(total),
            "open_debates": str(open_d),
            "active_debates": str(active),
            "finished_debates": str(finished),
            "completed_debates": str(claimed),
            "total_players": str(len(self.player_addresses)),
            "points_in_circulation": self.total_points_in_circulation,
        }, sort_keys=True)
