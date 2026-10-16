CATEGORY_LABELS = {
    "enere": "Enere",
    "toere": "Toere",
    "treere": "Treere",
    "firere": "Firere",
    "femmere": "Femmere",
    "seksere": "Seksere",
    "ett_par": "Ett par",
    "to_par": "To par",
    "tre_like": "Tre like",
    "fire_like": "Fire like",
    "liten_straight": "Liten straight",
    "stor_straight": "Stor straight",
    "hus": "Hus",
    "sjanse": "Sjanse",
    "yatzy": "Yatzy",
}

CATEGORY_ORDER = [
    "enere",
    "toere",
    "treere",
    "firere",
    "femmere",
    "seksere",
    "ett_par",
    "to_par",
    "tre_like",
    "fire_like",
    "liten_straight",
    "stor_straight",
    "hus",
    "sjanse",
    "yatzy",
]


class ScoreSheet:
    def __init__(self):
        self.scores = {cat: None for cat in CATEGORY_ORDER}

    def calculate_score(self, category: str, raw_dice_values: list) -> int:
        if not raw_dice_values or len(raw_dice_values) != 5:
            return 0

        dice_values = [int(v) for v in raw_dice_values]
        counts = {i: dice_values.count(i) for i in range(1, 7)}
        sorted_dice = sorted(dice_values)

        if category == "enere":
            return counts[1] * 1
        elif category == "toere":
            return counts[2] * 2
        elif category == "treere":
            return counts[3] * 3
        elif category == "firere":
            return counts[4] * 4
        elif category == "femmere":
            return counts[5] * 5
        elif category == "seksere":
            return counts[6] * 6

        elif category == "ett_par":
            for val in range(6, 0, -1):
                if counts[val] >= 2:
                    return val * 2
            return 0

        elif category == "to_par":
            pairs = [val for val in range(6, 0, -1) if counts[val] >= 2]
            if len(pairs) >= 2:
                return (pairs[0] * 2) + (pairs[1] * 2)
            return 0

        elif category == "tre_like":
            for val in range(6, 0, -1):
                if counts[val] >= 3:
                    return val * 3
            return 0

        elif category == "fire_like":
            for val in range(6, 0, -1):
                if counts[val] >= 4:
                    return val * 4
            return 0

        elif category == "liten_straight":
            return 15 if sorted_dice == [1, 2, 3, 4, 5] else 0

        elif category == "stor_straight":
            return 20 if sorted_dice == [2, 3, 4, 5, 6] else 0

        elif category == "hus":
            has_three = 0
            has_two = 0
            for val in range(6, 0, -1):
                if counts[val] == 3:
                    has_three = val
                elif counts[val] == 2:
                    has_two = val
            if has_three and has_two:
                return (has_three * 3) + (has_two * 2)
            return 0

        elif category == "sjanse":
            return sum(dice_values)

        elif category == "yatzy":
            for val in range(1, 7):
                if counts[val] == 5:
                    return 50
            return 0

        return 0

    def set_score(self, category: str, dice_values: list) -> bool:
        if category in self.scores and self.scores[category] is None:
            self.scores[category] = self.calculate_score(category, dice_values)
            return True
        return False

    def is_complete(self) -> bool:
        return all(val is not None for val in self.scores.values())

    def get_sum_upper(self) -> int:
        upper_keys = ["enere", "toere", "treere", "firere", "femmere", "seksere"]
        return sum(self.scores[key] for key in upper_keys if self.scores[key] is not None)

    def get_bonus(self) -> int:
        return 50 if self.get_sum_upper() >= 63 else 0

    def get_total_score(self) -> int:
        total = sum(val for val in self.scores.values() if val is not None)
        return total + self.get_bonus()