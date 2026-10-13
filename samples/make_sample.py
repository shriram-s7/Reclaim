"""Generate a deliberately fictional payment receipt for offline pipeline checks."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
def make_sample():
    image = Image.new('RGB', (720, 960), '#F6F8F2')
    draw = ImageDraw.Draw(image)
    def font(size):
        return ImageFont.truetype('C:/Windows/Fonts/arial.ttf', size) if Path('C:/Windows/Fonts/arial.ttf').exists() else ImageFont.load_default(size=size)
    draw.rounded_rectangle((35, 35, 685, 925), radius=26, fill='white', outline='#DEE6D5', width=2)
    draw.text((70, 80), 'RECLAIM / FICTIONAL SAMPLE', font=font(25), fill='#254B39')
    draw.text((70, 160), 'SYNTHETIC DATA - NOT A REAL PAYMENT', font=font(20), fill='#977338')
    draw.text((70, 230), 'INR 18,000.00', font=font(55), fill='#173F35')
    rows = [('Payment method', 'UPI'), ('Bank', 'Example Bank (fictional)'),
            ('Transaction reference', '701245678912'), ('Recipient', 'demo-recipient@example'),
            ('Date and time', '12 Oct 2026, 7:42 PM IST')]
    for i, (label, value) in enumerate(rows):
        y = 350 + i * 92
        draw.text((70, y), label.upper(), font=font(16), fill='#8A987E')
        draw.text((70, y+28), value, font=font(25), fill='#294333')
    draw.text((70, 850), 'For local demonstration only. No funds moved.', font=font(20), fill='#859476')
    image.save(ROOT / 'synthetic-payment.png')

if __name__ == '__main__':
    make_sample()
