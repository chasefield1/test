# Minesweeper (Console)

이 저장소에는 파이썬으로 작성한 간단한 콘솔 지뢰찾기 게임이 들어 있습니다.

## 실행 방법

```bash
python minesweeper.py [width] [height] [mines] [--seed SEED]
```

기본값은 10x10 보드, 15개의 지뢰입니다. 게임 중에는 다음 명령을 사용할 수 있습니다.

- `open x y` 또는 `o x y`: 해당 좌표의 칸을 엽니다.
- `flag x y` 또는 `f x y`: 해당 좌표에 깃발을 꽂거나 해제합니다.

게임을 종료하려면 `Ctrl+C`를 누르세요.
