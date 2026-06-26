# Ses Klonlama Planı

## Mevcut Durum
- Sunucuda GPU yok (CPU only)
- Piper TTS kullanılıyor (~0.1sn gecikme)
- 12 adet hazır Piper sesi var

## Hedef: Kullanıcının Kendi Sesini Kullanması

Her çağrıda gecikme yaşanmaması için **Piper fine-tune** yöntemi kullanılmalı.
Fine-tune bir kere yapılır, çıktı `.onnx` modeli normal Piper hızında çalışır.

## GPU'suz Ortamda Fine-Tune Seçenekleri

### Seçenek 1: Google Colab (Ücretsiz ✅, Önerilen)
- Google Colab'da GPU runtime (Tesla T4, ~15GB VRAM)
- Piper fine-tune scripti çalıştırılır
- Çıktı `.onnx` dosyası Google Drive'a kaydedilir
- Elle sunucuya yüklenir

**Süreç:**
```
1. Kullanıcı 30-60sn ses kaydeder (web arayüzü)
2. Kayıt .wav olarak sunucuya kaydedilir
3. Kullanıcıya Colab notebook linki + kayıt linki verilir
4. Kullanıcı Colab'da notebook'u çalıştırır
5. Fine-tune ~15-30dk sürer
6. Çıktı .onnx dosyası indirilir
7. Admin panelden yüklenir
```

### Seçenek 2: Replicate API (Ücretli ~$0.50/ses)
- `rerun/piper-voice-cloning` modeli
- API'ye ses kaydı gönderilir
- 15-30dk sonra model döner
- Ücretsiz krediler bittiğinde ücretli

### Seçenek 3: Kaggle (Ücretsiz ✅, haftada 30 saat GPU)
- Kaggle'da 2x Tesla T4 (haftada 30 saat)
- Colab'a benzer süreç
- Daha uzun kullanım süresi

### Seçenek 4: Hugging Face Spaces (Ücretsiz ✅, CPU-0.5)
- HF Spaces üzerinde piper fine-tune Space'i
- CPU only, çok yavaş (~5 saat)
- Sadece acil durum

## Önerilen Akış

```
Admin, Ses Kütüphanesi sayfasından "Ses Klonla" butonuna tıklar
    ↓
Kullanıcıdan 30-60sn ses kaydı alınır (mikrofon ile)
    ↓
Ses kaydı .wav olarak kaydedilir ve indirme linki oluşturulur
    ↓
Kullanıcıya Google Colab notebook'u açması söylenir:
  - Link: https://colab.research.google.com/github/.../piper-finetune.ipynb
  - Notebook ses kaydını alır, fine-tune yapar
  - Çıktı .onnx dosyasını indirme linki olarak döner
    ↓
Admin .onnx dosyasını Ses Kütüphanesi'nden yükler
    ↓
Model piper-server'a eklenir ve kullanıma hazır
```

## Colab Notebook İçeriği (Yazılacak)

Piper fine-tune için gereken adımlar:
1. Piper repository'sini klonla
2. Ses kaydını indir
3. Fine-tune scriptini çalıştır
4. Çıktı .onnx modelini sıkıştır
5. İndirme linki oluştur

## Uygulama Zamanı

Şimdilik hazır sesler ile devam ediyoruz.
Ses klonlama özelliği Colab notebook hazır olduğunda eklenir.
