import argparse
from typing import Optional

from agents.validator_ruc import call_sri, assess_related
from rapidfuzz import fuzz


def run_check(ruc: str, objeto: str, razon_input: Optional[str] = None):
    data = call_sri(ruc)
    if not data:
        print(f"RUC {ruc}: NO EXISTE en SRI o sin datos")
        return 1
    actividad = (data.get("actividadEconomicaPrincipal") or "").strip()
    razon_sri = (data.get("razonSocial") or "").strip()

    print("=== Datos SRI ===")
    print(f"RUC: {ruc}")
    print(f"Razón social (SRI): {razon_sri}")
    print(f"Actividad principal: {actividad}")
    if razon_input:
        sim_rz = fuzz.token_set_ratio(razon_input.lower(), razon_sri.lower())
        print(f"Razón social (entrada): {razon_input}  | similitud con SRI: {sim_rz}")

    res = assess_related(actividad, razon_sri, objeto)
    print("\n=== Validación ===")
    print(f"Objeto del contrato: {objeto}")
    print(f"related: {res.get('related')}")
    print(f"why: {res.get('why')}")
    print(f"riesgo: {'BAJO' if res.get('related') else 'ALTO'}")
    return 0


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Verifica RUC contra SRI y reglas de coherencia")
    p.add_argument("--ruc", required=False)
    p.add_argument("--objeto", required=False, help="Objeto del contrato/proyecto")
    p.add_argument("--razon", required=False, help="Razón social digitada (opcional)")
    args = p.parse_args()

    if args.ruc and args.objeto:
        raise SystemExit(run_check(args.ruc.strip(), args.objeto.strip(), args.razon.strip() if args.razon else None))

    try:
        ruc = input("RUC: ").strip()
        razon_in = input("Razón social (opcional): ").strip() or None
        objeto = input("Objeto del contrato/proyecto: ").strip()
    except KeyboardInterrupt:
        raise SystemExit(130)
    raise SystemExit(run_check(ruc, objeto, razon_in))


