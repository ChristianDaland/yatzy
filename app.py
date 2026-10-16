import random
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from score_sheet import ScoreSheet, CATEGORY_LABELS, CATEGORY_ORDER

MAX_PLAYERS = 5
STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI()

# allow_credentials kan ikke kombineres med allow_origins=["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class GameState:
    def __init__(self):
        self.reset_game(["Alice", "Bob"])

    def reset_game(self, player_names=None):
        if player_names:
            self.players = player_names
        self.current_player_index = 0
        self.rolls_left = 3
        self.dice_values = [1, 1, 1, 1, 1]
        self.held_dice = [False, False, False, False, False]
        self.scoreboards = {player: ScoreSheet() for player in self.players}

    def is_game_over(self) -> bool:
        return all(sheet.is_complete() for sheet in self.scoreboards.values())


game = GameState()


class StartGameRequest(BaseModel):
    players: list[str]


class HoldRequest(BaseModel):
    held: list[bool]


class ScoreRequest(BaseModel):
    category: str


@app.post("/api/start")
def start_game(req: StartGameRequest):
    players = [name.strip() for name in req.players if name.strip()]
    if not players:
        raise HTTPException(status_code=400, detail="Må oppgi minst én spiller")
    if len(players) > MAX_PLAYERS:
        raise HTTPException(status_code=400, detail=f"Maksimalt {MAX_PLAYERS} spillere")
    if len(set(players)) != len(players):
        raise HTTPException(status_code=400, detail="Spillernavn må være unike")
    game.reset_game(players)
    return get_game_state()


@app.get("/api/state")
def get_game_state():
    current_player = game.players[game.current_player_index]

    scoreboards_data = {}
    for player, sheet in game.scoreboards.items():
        scoreboards_data[player] = {
            "scores": sheet.scores,
            "sum_upper": sheet.get_sum_upper(),
            "bonus": sheet.get_bonus(),
            "total": sheet.get_total_score(),
        }

    return {
        "players": game.players,
        "current_player": current_player,
        "rolls_left": game.rolls_left,
        "dice_values": game.dice_values,
        "held_dice": game.held_dice,
        "scoreboards": scoreboards_data,
        "game_over": game.is_game_over(),
        "category_order": CATEGORY_ORDER,
        "category_labels": CATEGORY_LABELS,
    }


@app.post("/api/roll")
def roll_dice():
    if game.is_game_over():
        raise HTTPException(status_code=400, detail="Spillet er ferdig")
    if game.rolls_left <= 0:
        raise HTTPException(status_code=400, detail="Ingen kast igjen")

    for i in range(5):
        if not game.held_dice[i]:
            game.dice_values[i] = random.randint(1, 6)

    game.rolls_left -= 1
    return get_game_state()


@app.post("/api/hold")
def set_hold(req: HoldRequest):
    if len(req.held) != 5:
        raise HTTPException(status_code=400, detail="Må gi 5 boolske verdier")
    # Terningene fra forrige spiller kan ikke holdes før man har kastet selv
    if game.rolls_left == 3:
        raise HTTPException(status_code=400, detail="Må kaste før man kan holde terninger")
    if game.rolls_left == 0:
        raise HTTPException(status_code=400, detail="Ingen kast igjen")
    game.held_dice = list(req.held)
    return get_game_state()


@app.post("/api/score")
def select_score(req: ScoreRequest):
    if game.is_game_over():
        raise HTTPException(status_code=400, detail="Spillet er ferdig")
    if game.rolls_left == 3:
        raise HTTPException(status_code=400, detail="Må kaste terningene minst én gang")

    current_player = game.players[game.current_player_index]
    sheet = game.scoreboards[current_player]

    success = sheet.set_score(req.category, game.dice_values)
    if not success:
        raise HTTPException(status_code=400, detail="Kategorien er allerede brukt eller ugyldig")

    game.rolls_left = 3
    game.held_dice = [False, False, False, False, False]
    game.current_player_index = (game.current_player_index + 1) % len(game.players)

    return get_game_state()


# Frontend-filene ligger foreløpig i rotmappen; mount bare hvis static/ finnes,
# ellers krasjer serveren ved oppstart (og rotmappen ville eksponert .py-filene).
if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
