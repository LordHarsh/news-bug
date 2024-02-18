import os
import cv2 
import pytesseract
from pdf2image import convert_from_path
 
 
# Store Pdf with convert_from_path function
def convert(filepath:str):
  if not os.path.exists('images'):
    os.makedirs('images')
  filename = os.path.basename(filepath)
  filename = os.path.splitext(filename)[0]
  print(f"Converting pdf: {filename}")
  images = convert_from_path(filepath)
  if not os.path.exists('images/'+filename):
    os.makedirs('images/'+filename)
  print(f"PDF converted: {filename} done")
  for i in range(len(images)):
    images[i].save('images/'+filename+'/page'+ str(i) +'.jpg', 'JPEG')
  print(f"Images saved to: imagees/{filename}")
  return 'images/'+filename

def ocr(folderpath:str):
  text = {}
  if not os.path.exists('text'):
    os.makedirs('text')
  for filename in os.listdir(folderpath):
    if filename.endswith(".jpg"):
      print(f"Performing OCR on: {filename}")
      img = cv2.imread(os.path.join(folderpath, filename))
      text[filename] = pytesseract.image_to_string(img)
      with open(f'text/{filename}.txt', 'w') as f:
        f.write(text[filename])
      
  return text


if __name__ == "__main__":
  # folderpath = convert('input/newspaper.pdf')
  data = ocr('images/newspaper')