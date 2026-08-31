"""
Ilac etkilesimi seed verisi.

Bu dosya, README.md ve arXiv makalesinde iddia edilen "30 clinically
significant pre-seeded drug interactions" ifadesini GERCEKTEN
dogrulanabilir hale getirmek icin yazildi. Onceden kodda hicbir seed
mekanizmasi olmadigi (drug_interactions tablosu 0 satirla basliyordu)
tespit edildi -- bu dosya o eksigi gideriyor.

Listedeki 30 cift, standart farmakoloji ders kitaplarinda / ilac
prospektuslerinde yer alan, yaygin olarak bilinen etkilesimlerdir
(orn. NSAID + antikoagulan kanama riski, SSRI + opioid serotonin
sendromu riski, makrolid + statin miyopati riski gibi). Isimler,
backend/main.py::_seed_demo_data() icindeki PRODUCTS listesiyle
(check_drug_interactions()'daki alt-dize eslestirmesiyle uyumlu
olacak sekilde) birebir calisir.

Kullanim:
    from agents.drug_interaction_seed_data import seed_drug_interactions
    seed_drug_interactions(db)   # idempotent -- zaten varsa tekrar eklemez
"""
from backend.models import DrugInteraction

# (ilac_a, ilac_b, siddet, aciklama)
# siddet: "mild" | "moderate" | "severe"
INTERACTIONS = [
    ("Coumadin", "Aspirin", "severe",
     "Antikoagulan + antiagregan kombinasyonu kanama riskini artirir."),
    ("Coumadin", "İbuprofen", "severe",
     "NSAID, warfarinin etkisini potansiyalize ederek kanama riskini artirir."),
    ("Coumadin", "Diklofenak", "severe",
     "NSAID, warfarinin etkisini potansiyalize ederek kanama riskini artirir."),
    ("Coumadin", "Klaritromisin", "severe",
     "Klaritromisin CYP3A4 inhibisyonu ile warfarin duzeyini ve INR'yi yukseltir."),
    ("Coumadin", "Siprofloksasin", "moderate",
     "Kinolonlar warfarinin antikoagulan etkisini guclendirebilir."),
    ("Coumadin", "Amoksisilin", "moderate",
     "Antibiyotik kullanimi barsak florasini etkileyerek INR'de yukselmeye yol acabilir."),
    ("Coumadin", "Augmentin", "moderate",
     "Antibiyotik kullanimi barsak florasini etkileyerek INR'de yukselmeye yol acabilir."),
    ("Coumadin", "Metilprednizolon", "moderate",
     "Kortikosteroidler antikoagulan yanitini degistirebilir, INR takibi gerekir."),
    ("Coumadin", "Omega-3", "moderate",
     "Yuksek doz balik yagi, antikoagulanla birlikte ek kanama riski olusturabilir."),
    ("Coumadin", "Parol", "moderate",
     "Kronik yuksek doz parasetamol warfarin etkisini potansiyalize edip INR'yi yukseltebilir."),
    ("Coumadin", "Parol Forte", "moderate",
     "Kronik yuksek doz parasetamol warfarin etkisini potansiyalize edip INR'yi yukseltebilir."),
    ("Aspirin", "İbuprofen", "moderate",
     "Ibuprofen, aspirinin kardiyoprotektif antiagregan etkisini azaltabilir."),
    ("Aspirin", "Sertralin", "moderate",
     "SSRI + antiagregan kombinasyonu gastrointestinal kanama riskini artirir."),
    ("İbuprofen", "Sertralin", "moderate",
     "SSRI + NSAID kombinasyonu gastrointestinal kanama riskini artirir."),
    ("Diklofenak", "Sertralin", "moderate",
     "SSRI + NSAID kombinasyonu gastrointestinal kanama riskini artirir."),
    ("Tramadol", "Sertralin", "severe",
     "Iki serotonerjik ajanin birlikte kullanimi serotonin sendromu riski tasir."),
    ("Klaritromisin", "Atorvastatin", "severe",
     "Klaritromisin, statin duzeyini yukselterek miyopati/rabdomiyoliz riskini artirir."),
    ("Klaritromisin", "Amlodipin", "moderate",
     "CYP3A4 inhibisyonu amlodipin duzeyini yukseltip hipotansiyona yol acabilir."),
    ("İbuprofen", "Losartan", "moderate",
     "NSAID, antihipertansif etkiyi azaltabilir ve renal fonksiyonu etkileyebilir."),
    ("Diklofenak", "Losartan", "moderate",
     "NSAID, antihipertansif etkiyi azaltabilir ve renal fonksiyonu etkileyebilir."),
    ("İbuprofen", "Metoprolol", "moderate",
     "NSAID, beta-blokerin antihipertansif etkisini azaltabilir."),
    ("Diklofenak", "Metoprolol", "moderate",
     "NSAID, beta-blokerin antihipertansif etkisini azaltabilir."),
    ("İbuprofen", "Metilprednizolon", "moderate",
     "NSAID + kortikosteroid kombinasyonu gastrointestinal ulser/kanama riskini artirir."),
    ("Diklofenak", "Metilprednizolon", "moderate",
     "NSAID + kortikosteroid kombinasyonu gastrointestinal ulser/kanama riskini artirir."),
    ("Losartan", "Metilprednizolon", "mild",
     "Kortikosteroidler kan basincini yukselterek antihipertansif etkiyi azaltabilir."),
    ("Amoksisilin", "Probiyotik", "mild",
     "Ayni anda alinirsa antibiyotik probiyotik etkinligini azaltabilir; araya zaman konmasi onerilir."),
    ("Augmentin", "Probiyotik", "mild",
     "Ayni anda alinirsa antibiyotik probiyotik etkinligini azaltabilir; araya zaman konmasi onerilir."),
    ("Metoprolol", "Amlodipin", "moderate",
     "Iki antihipertansifin kombinasyonu asiri bradikardi/hipotansiyon riski tasir, izlem gerekir."),
    ("Siprofloksasin", "Vitamin C", "mild",
     "Yuksek doz askorbik asit, kinolon emilimini hafifce azaltabilir."),
    ("Esomeprazol", "Klaritromisin", "mild",
     "PPI + makrolid kombinasyonu (orn. H. pylori tedavisinde) hafif QT uzamasi riski tasiyabilir."),
]


def seed_drug_interactions(db) -> int:
    """INTERACTIONS listesindeki ciftleri drug_interactions tablosuna ekler.

    Idempotent: ayni (drug_a, drug_b) cifti (yon farketmeksizin) zaten
    varsa tekrar eklenmez, boylece bu fonksiyon guvenle birden fazla
    kez cagirilabilir (orn. /seed-demo-data endpoint'i her tetiklendiginde).

    Returns:
        Eklenen yeni satir sayisi.
    """
    existing = db.query(DrugInteraction).all()
    existing_pairs = {
        frozenset([e.drug_a.lower().strip(), e.drug_b.lower().strip()])
        for e in existing
    }

    added = 0
    for drug_a, drug_b, severity, description in INTERACTIONS:
        key = frozenset([drug_a.lower().strip(), drug_b.lower().strip()])
        if key in existing_pairs:
            continue
        db.add(DrugInteraction(
            drug_a=drug_a, drug_b=drug_b,
            severity=severity, description=description,
        ))
        existing_pairs.add(key)
        added += 1

    if added:
        db.commit()
    return added


if __name__ == "__main__":
    # Standalone calistirma: varsayilan gelistirme veritabanini (pharmaicy.db) doldurur.
    import sys
    import os
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    from backend.database import SessionLocal

    db = SessionLocal()
    try:
        n = seed_drug_interactions(db)
        total = db.query(DrugInteraction).count()
        print(f"{n} yeni etkilesim eklendi. Tabloda toplam {total} kayit var.")
    finally:
        db.close()
