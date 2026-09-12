from typing import Any, Dict, List

from sqlalchemy.orm import Session

from . import models
from .events import EventStream
from .modules import js_analyzer, server_fingerprint, spa_discovery, ssl_tls

PHASES: List[Dict[str, Any]] = [
    {"id": 1, "name": "SSL/TLS handshake analysis"},
    {"id": 2, "name": "Server fingerprinting"},
    {"id": 3, "name": "JS bundle analysis"},
    {"id": 4, "name": "SPA route discovery"},
]
TOTAL_PHASES = len(PHASES)


def _technology_item(
    category: str,
    name: str,
    version: Any = None,
    confidence: Any = None,
    evidence: Any = None,
) -> Dict[str, Any]:
    return {
        "kind": "technology",
        "category": category,
        "name": name,
        "version": version,
        "confidence": confidence,
        "evidence": evidence,
    }


def _route_item(
    path: str,
    framework: Any = None,
    route_type: Any = None,
    module: Any = None,
) -> Dict[str, Any]:
    return {
        "kind": "route",
        "path": path,
        "framework": framework,
        "route_type": route_type,
        "module": module,
    }


def _dependency_item(
    name: str,
    version: Any = None,
    source: Any = None,
    package_manager: Any = None,
) -> Dict[str, Any]:
    return {
        "kind": "dependency",
        "name": name,
        "version": version,
        "source": source,
        "package_manager": package_manager,
    }


async def run_full_profile(
    target: str,
    stream: EventStream,
    db: Session,
    profile_id: int,
    timeout_seconds: int = 180,
) -> Dict[str, Any]:
    """Run the four profiling phases, persisting results and streaming events.

    Returns the completion summary embedded in the `analysis_completed` event.
    """
    summary = {"technologies": 0, "routes": 0, "guards": 0, "dependencies": 0}

    async def log(msg: str):
        await stream.log(msg)

    async def progress(phase: Dict[str, Any], status: str):
        percent = round(
            (phase["id"] / TOTAL_PHASES) * 100 if status == "complete"
            else ((phase["id"] - 1) / TOTAL_PHASES) * 100
        )
        await stream.emit(
            "analysis_progress",
            {
                "phase": phase["id"],
                "total_phases": TOTAL_PHASES,
                "name": phase["name"],
                "status": status,
                "percent": percent,
            },
        )

    async def emit_items(items: List[Dict[str, Any]]):
        for item in items:
            if item["kind"] == "technology":
                summary["technologies"] += 1
            elif item["kind"] == "dependency":
                summary["dependencies"] += 1
            elif item["kind"] == "route":
                if item.get("route_type") == "guard":
                    summary["guards"] += 1
                else:
                    summary["routes"] += 1
            await stream.emit("item_found", item)

    await log(f"[kensei] starting full profile for {target}")

    # Phase 1: SSL/TLS handshake
    await progress(PHASES[0], "running")
    await log("[kensei] phase 1/4 — SSL/TLS handshake analysis")
    try:
        ssl_result = await ssl_tls.run(target, log)
        await emit_items(_save_ssl_findings(db, profile_id, ssl_result))
        await log("[kensei] SSL/TLS analysis complete")
    except Exception as e:
        await log(f"[kensei] SSL/TLS error: {str(e)}")
    await progress(PHASES[0], "complete")

    # Phase 2: Server Fingerprinting
    await progress(PHASES[1], "running")
    await log("[kensei] phase 2/4 — server fingerprinting")
    try:
        fingerprint = await server_fingerprint.run(target, log)
        await emit_items(_save_server_findings(db, profile_id, fingerprint))
        await log("[kensei] server fingerprinting complete")
    except Exception as e:
        await log(f"[kensei] server fingerprinting error: {str(e)}")
    await progress(PHASES[1], "complete")

    # Phase 3: JS Bundle Analysis
    await progress(PHASES[2], "running")
    await log("[kensei] phase 3/4 — JS bundle analysis")
    try:
        js_results = await js_analyzer.run(target, log)
        await emit_items(_save_js_findings(db, profile_id, js_results))
        await log("[kensei] JS bundle analysis complete")
    except Exception as e:
        await log(f"[kensei] JS bundle analysis error: {str(e)}")
    await progress(PHASES[2], "complete")

    # Phase 4: SPA Route Discovery
    await progress(PHASES[3], "running")
    await log("[kensei] phase 4/4 — SPA route discovery")
    try:
        routes = await spa_discovery.run(target, log)
        await emit_items(_save_route_findings(db, profile_id, routes))
        await log("[kensei] SPA route discovery complete")
    except Exception as e:
        await log(f"[kensei] SPA route discovery error: {str(e)}")
    await progress(PHASES[3], "complete")

    await log("[kensei] profile complete")
    return summary


def _save_ssl_findings(db: Session, profile_id: int, ssl_result: Dict[str, Any]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []

    tls_version = ssl_result.get("tls_version")
    if tls_version:
        db.add(models.Technology(
            profile_id=profile_id,
            category="security",
            name=f"TLS/{tls_version}",
            version=tls_version,
            confidence="high",
            evidence=ssl_result.get("cipher_suite", ""),
        ))
        items.append(_technology_item(
            "security", f"TLS/{tls_version}", tls_version, "high",
            ssl_result.get("cipher_suite", ""),
        ))

    cipher = ssl_result.get("cipher_suite")
    if cipher:
        db.add(models.Technology(
            profile_id=profile_id,
            category="security",
            name=f"Cipher/{cipher.split('-')[0] if '-' in cipher else cipher}",
            version=cipher,
            confidence="high",
            evidence=f"strength: {ssl_result.get('cipher_strength', 'unknown')}",
        ))
        items.append(_technology_item(
            "security",
            f"Cipher/{cipher.split('-')[0] if '-' in cipher else cipher}",
            cipher,
            "high",
            f"strength: {ssl_result.get('cipher_strength', 'unknown')}",
        ))

    cert_subject = ssl_result.get("cert_subject")
    if cert_subject:
        cn = cert_subject.get("commonName", "unknown")
        issuer = ssl_result.get("cert_issuer", {}).get("organizationName", "unknown")
        evidence = f"issuer: {issuer} | expires: {ssl_result.get('cert_expiry', 'unknown')}"
        db.add(models.Technology(
            profile_id=profile_id,
            category="certificate",
            name=f"CN={cn}",
            version=None,
            confidence="high",
            evidence=evidence,
        ))
        items.append(_technology_item("certificate", f"CN={cn}", None, "high", evidence))

    cert_fp = ssl_result.get("cert_fingerprint_sha256")
    if cert_fp:
        db.add(models.Technology(
            profile_id=profile_id,
            category="certificate",
            name="SHA-256 Fingerprint",
            version=cert_fp[:16] + "...",
            confidence="high",
            evidence=f"SHA256:{cert_fp}",
        ))
        items.append(_technology_item(
            "certificate", "SHA-256 Fingerprint", cert_fp[:16] + "...", "high", f"SHA256:{cert_fp}",
        ))

    db.commit()
    return items


def _save_server_findings(db: Session, profile_id: int, fingerprint: Dict[str, Any]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []

    for svr in fingerprint.get("servers", []):
        name = svr.get("name", "unknown")
        db.add(models.Technology(
            profile_id=profile_id,
            category="backend",
            name=name,
            version=svr.get("version"),
            confidence=svr.get("confidence", "medium"),
            evidence=svr.get("evidence"),
        ))
        items.append(_technology_item(
            "backend", name, svr.get("version"), svr.get("confidence", "medium"), svr.get("evidence"),
        ))

    cdn = fingerprint.get("cdn")
    if cdn:
        name = cdn.get("name", "unknown")
        db.add(models.Technology(
            profile_id=profile_id,
            category="cdn",
            name=name,
            version=cdn.get("version"),
            confidence=cdn.get("confidence", "medium"),
            evidence=cdn.get("evidence"),
        ))
        items.append(_technology_item(
            "cdn", name, cdn.get("version"), cdn.get("confidence", "medium"), cdn.get("evidence"),
        ))

    db.commit()
    return items


def _save_js_findings(db: Session, profile_id: int, js_results: Dict[str, Any]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []

    for dep in js_results.get("dependencies", []):
        name = dep.get("name", "unknown")
        db.add(models.JsDependency(
            profile_id=profile_id,
            name=name,
            version=dep.get("version"),
            source=dep.get("source"),
            package_manager=dep.get("package_manager", "unknown"),
        ))
        items.append(_dependency_item(
            name, dep.get("version"), dep.get("source"), dep.get("package_manager", "unknown"),
        ))

    for t in js_results.get("technologies", []):
        name = t.get("name", "unknown")
        db.add(models.Technology(
            profile_id=profile_id,
            category="frontend",
            name=name,
            version=t.get("version"),
            confidence=t.get("confidence", "medium"),
            evidence=t.get("evidence"),
        ))
        items.append(_technology_item(
            "frontend", name, t.get("version"), t.get("confidence", "medium"), t.get("evidence"),
        ))

    for o in js_results.get("outdated", []):
        name = o.get("name", "unknown")
        version = f"{o.get('current', '?')} -> {o.get('latest', '?')}"
        db.add(models.Technology(
            profile_id=profile_id,
            category="outdated",
            name=name,
            version=version,
            confidence="medium",
            evidence=f"status: {o.get('status', 'unknown')}",
        ))
        items.append(_technology_item(
            "outdated", name, version, "medium", f"status: {o.get('status', 'unknown')}",
        ))

    mf = js_results.get("module_federation", {})
    if mf:
        for key in mf:
            if key in ("remote_entries", "exposed_modules"):
                continue
            db.add(models.Technology(
                profile_id=profile_id,
                category="architecture",
                name=f"ModuleFederation/{key}",
                version=None,
                confidence="high",
                evidence=f"module federation {key} detected",
            ))
            items.append(_technology_item(
                "architecture", f"ModuleFederation/{key}", None, "high",
                f"module federation {key} detected",
            ))

    db.commit()
    return items


def _save_route_findings(db: Session, profile_id: int, routes: Dict[str, Any]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []

    for r in routes.get("routes", []):
        db.add(models.DiscoveredRoute(
            profile_id=profile_id,
            path=r.get("path", ""),
            framework=r.get("framework"),
            route_type=r.get("route_type"),
            module=r.get("module"),
        ))
        items.append(_route_item(
            r.get("path", ""), r.get("framework"), r.get("route_type"), r.get("module"),
        ))

    for g in routes.get("guards", []):
        db.add(models.DiscoveredRoute(
            profile_id=profile_id,
            path=g.get("guard", ""),
            framework=g.get("framework"),
            route_type="guard",
            module=g.get("source"),
        ))
        items.append(_route_item(
            g.get("guard", ""), g.get("framework"), "guard", g.get("source"),
        ))

    db.commit()
    return items
