"""Проверка демо-блока «до и после» SaaS-лендинга движком FonoWriter.

Прогон: python proof/measure.py (workdir — корень проекта fonowriter-saas).
Метод: zhuravlev (24 шкалы). Исторический прогон: 2026-09-06, FonoWriter v0.3.0.
Скрипт сверяет напечатанные на лендинге значения с движком, код возврата 1 при расхождении.
"""
import sys
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
FW = Path(r"E:\MY-LIFE-SYSTEM\FonoWriter")
sys.path.insert(0, str(FW / "src"))

from fonowriter.core.engine import FonoWriterEngine  # noqa: E402

BEFORE = "Мы делаем крутые сайты для вашего бизнеса. Наши специалисты работают быстро и качественно."
AFTER = "Мы создаём надёжные решения для вашего бизнеса. Наша команда работает уверенно и доводит дело до результата."

# scale -> (before, after) как напечатано на лендинге
LANDING = {
    "Хороший — Плохой": (-5.8, 5.2),
    "Красивый — Отталкивающий": (-6.0, 2.5),
    "Сильный — Слабый": (2.1, 12.0),
    "Яркий — Тусклый": (-5.4, 9.0),
}


def main() -> int:
    engine = FonoWriterEngine()
    before = {s.name: round(s.score, 1) for s in engine.analyze(BEFORE, "zhuravlev").scales}
    after = {s.name: round(s.score, 1) for s in engine.analyze(AFTER, "zhuravlev").scales}
    (HERE / "scales.json").write_text(
        json.dumps({"before": before, "after": after}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    mismatches = [
        f"{scale}: engine=({before[scale]}, {after[scale]}) landing={LANDING[scale]}"
        for scale in LANDING
        if before[scale] != LANDING[scale][0] or after[scale] != LANDING[scale][1]
    ]
    if mismatches:
        print("MISMATCH:")
        print("\n".join(mismatches))
        return 1
    print(f"OK: {len(LANDING)} значений лендинга совпали с движком")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
