"""Console-based Minesweeper implementation.

This module implements the game logic for Minesweeper and provides a
simple interactive command line interface that can be executed directly.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Iterable, List, Optional, Set, Tuple

Coordinate = Tuple[int, int]


@dataclass
class Minesweeper:
    """Encapsulates the state of a Minesweeper board."""

    width: int
    height: int
    mine_count: int
    seed: Optional[int] = None
    mines: Set[Coordinate] = field(init=False)
    opened: Set[Coordinate] = field(default_factory=set, init=False)
    flags: Set[Coordinate] = field(default_factory=set, init=False)
    _lost: bool = field(default=False, init=False)

    def __post_init__(self) -> None:
        if self.width <= 0 or self.height <= 0:
            raise ValueError("Board dimensions must be positive")
        max_cells = self.width * self.height
        if not (0 < self.mine_count < max_cells):
            raise ValueError("Number of mines must be between 1 and the number of cells - 1")

        rng = random.Random(self.seed)
        cells = [(x, y) for x in range(self.width) for y in range(self.height)]
        rng.shuffle(cells)
        self.mines = set(cells[: self.mine_count])

    def _neighbors(self, coord: Coordinate) -> Iterable[Coordinate]:
        x, y = coord
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx == dy == 0:
                    continue
                nx, ny = x + dx, y + dy
                if 0 <= nx < self.width and 0 <= ny < self.height:
                    yield nx, ny

    def adjacent_mine_count(self, coord: Coordinate) -> int:
        return sum((neighbor in self.mines) for neighbor in self._neighbors(coord))

    def open_cell(self, coord: Coordinate) -> Set[Coordinate]:
        """Open a cell and return the set of newly opened cells.

        If a mine is opened the game is lost and all remaining unopened cells
        stay closed, mirroring the behavior of the classic game.
        """

        if self._lost or self.is_won():
            return set()

        if coord in self.opened:
            return set()

        if coord in self.flags:
            self.flags.remove(coord)

        self.opened.add(coord)
        newly_opened = {coord}

        if coord in self.mines:
            self._lost = True
            return newly_opened

        if self.adjacent_mine_count(coord) == 0:
            stack: List[Coordinate] = [coord]
            while stack:
                cx, cy = stack.pop()
                for neighbor in self._neighbors((cx, cy)):
                    if neighbor in self.opened or neighbor in self.mines:
                        continue
                    self.opened.add(neighbor)
                    newly_opened.add(neighbor)
                    if self.adjacent_mine_count(neighbor) == 0:
                        stack.append(neighbor)

        return newly_opened

    def toggle_flag(self, coord: Coordinate) -> bool:
        """Toggle a flag on the given coordinate.

        Returns whether the cell is now flagged.
        """

        if self._lost or self.is_won() or coord in self.opened:
            return False

        if coord in self.flags:
            self.flags.remove(coord)
            return False
        self.flags.add(coord)
        return True

    def is_won(self) -> bool:
        return len(self.opened) == self.width * self.height - self.mine_count and not self._lost

    def is_lost(self) -> bool:
        return self._lost

    def render(self, reveal: bool = False) -> str:
        """Return a string representation of the board.

        If ``reveal`` is True all mines are shown; otherwise only opened cells
        are revealed.
        """

        lines: List[str] = []
        header = "   " + " ".join(f"{x:2d}" for x in range(self.width))
        lines.append(header)
        border = "   " + "-" * (3 * self.width - 1)
        lines.append(border)
        for y in range(self.height):
            row: List[str] = [f"{y:2d}|"]
            for x in range(self.width):
                coord = (x, y)
                if coord in self.opened or (reveal and coord in self.mines):
                    if coord in self.mines:
                        cell = " *"
                    else:
                        count = self.adjacent_mine_count(coord)
                        cell = "  " if count == 0 else f" {count}"
                elif coord in self.flags:
                    cell = " F"
                else:
                    cell = " ."
                row.append(cell)
            lines.append("".join(row))
        return "\n".join(lines)

    def status_message(self) -> str:
        if self.is_won():
            return "You cleared all the mines!"
        if self.is_lost():
            return "Boom! You hit a mine."
        return f"Mines remaining (estimated): {self.mine_count - len(self.flags)}"


def parse_command(command: str) -> Tuple[str, Coordinate]:
    """Parse a user command of the form ``<action> x y``.

    Returns a tuple of the action (``"open"`` or ``"flag"``) and the
    coordinate.
    """

    parts = command.strip().split()
    if len(parts) != 3:
        raise ValueError("Command must be in the format '<action> x y'")

    action, xs, ys = parts
    action = action.lower()
    if action not in {"open", "o", "flag", "f"}:
        raise ValueError("Action must be 'open'/'o' or 'flag'/'f'")

    try:
        x, y = int(xs), int(ys)
    except ValueError as exc:
        raise ValueError("Coordinates must be integers") from exc

    return action, (x, y)


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Play Minesweeper in the terminal.")
    parser.add_argument("width", type=int, nargs="?", default=10, help="Board width")
    parser.add_argument("height", type=int, nargs="?", default=10, help="Board height")
    parser.add_argument(
        "mines", type=int, nargs="?", default=15, help="Number of mines to place on the board"
    )
    parser.add_argument("--seed", type=int, default=None, help="Seed for mine placement")

    args = parser.parse_args()

    game = Minesweeper(args.width, args.height, args.mines, seed=args.seed)

    print("Welcome to Minesweeper!")
    print("Enter commands in the form 'open x y' or 'flag x y'.")
    print("Type Ctrl+C to quit.")

    while True:
        print()
        print(game.render(reveal=game.is_lost()))
        print(game.status_message())

        if game.is_won() or game.is_lost():
            break

        try:
            command = input("> ")
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            return

        try:
            action, coord = parse_command(command)
        except ValueError as exc:
            print(f"Invalid command: {exc}")
            continue

        x, y = coord
        if not (0 <= x < game.width and 0 <= y < game.height):
            print("Coordinates out of bounds.")
            continue

        if action in {"open", "o"}:
            opened = game.open_cell(coord)
            if not opened:
                print("Nothing happened.")
        else:
            flagged = game.toggle_flag(coord)
            print("Flagged." if flagged else "Flag removed.")


if __name__ == "__main__":
    main()
