import argparse
import json
from typing import Optional

from agents.validator_ruc import run, call_sri


def run_check(ruc: str, objeto: str, razon_input: Optional[str] = None, verbose: bool = False):
    # Llamamos directamente al método run completo del validador
    result = run(ruc, objeto)
    
    if not result.get("exists", False):
        print(f"RUC {ruc}: NO EXISTE en SRI o sin datos")
        return 1
    
    print("=== Datos SRI ===")
    print(f"RUC: {ruc}")
    print(f"Razón social: {result.get('razon_social', 'No disponible')}")
    print(f"Actividad principal: {result.get('actividad_economica', 'No disponible')}")
    print(f"Estado contribuyente: {result.get('estado_contribuyente', 'No disponible')}")
    print(f"Tipo contribuyente: {result.get('tipo_contribuyente', 'No disponible')}")
    print(f"Obligado contabilidad: {result.get('obligado_contabilidad', 'No disponible')}")
    
    if razon_input:
        print(f"Razón social (entrada): {razon_input}")
        if razon_input.lower() not in result.get('razon_social', '').lower():
            print(f"ADVERTENCIA: La razón social ingresada no coincide con la del SRI")
    
    print("\n=== Validación ===")
    print(f"Objeto del contrato: {objeto}")
    print(f"Evaluación con IA: {'Sí' if result.get('ai_powered', False) else 'No'}")
    print(f"Compatible con objeto: {result.get('related', False)}")
    print(f"Nivel de confianza: {result.get('confidence', 'N/A')}/100")
    print(f"Nivel de riesgo: {result.get('risk', 'ALTO')}")
    print(f"Explicación: {result.get('rationale', 'No disponible')}")
    
    if verbose:
        print("\n=== Datos completos ===")
        print(json.dumps(result, indent=2, ensure_ascii=False))
    
    return 0 if result.get('related', False) else 1


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Verifica RUC contra SRI y valida compatibilidad con proyecto")
    p.add_argument("--ruc", required=False, help="RUC de la empresa")
    p.add_argument("--objeto", required=False, help="Objeto del contrato/proyecto")
    p.add_argument("--razon", required=False, help="Razón social digitada (opcional)")
    p.add_argument("--verbose", "-v", action="store_true", help="Mostrar datos completos")
    args = p.parse_args()

    if args.ruc and args.objeto:
        raise SystemExit(run_check(args.ruc.strip(), args.objeto.strip(), 
                                  args.razon.strip() if args.razon else None,
                                  args.verbose))

    try:
        print("=== Validador de RUC para proyectos ===")
        ruc = input("RUC: ").strip()
        razon_in = input("Razón social (opcional): ").strip() or None
        objeto = input("Objeto del contrato/proyecto: ").strip()
        verbose = input("¿Mostrar datos completos? (s/N): ").strip().lower() == 's'
    except KeyboardInterrupt:
        print("\nProceso cancelado")
        raise SystemExit(130)
    
    raise SystemExit(run_check(ruc, objeto, razon_in, verbose))


