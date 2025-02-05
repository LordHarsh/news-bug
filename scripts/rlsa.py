import cv2
import numpy as np

# Load the image
image = cv2.imread('page11.jpg', 0)


# Apply RLSA horizontally
for i in range(1, image.shape[0]):
    c = 1
    for j in range(1, image.shape[1]):
        if image[i, j] == 0:
            if (j-c) <= 10:
                image[i, c:j] = 0
            c = j
        if (image.shape[1] - c) <= 10:
            image[i, c:image.shape[1]] = 0

# Apply RLSA vertically
for i in range(1, image.shape[1]):
    c = 1
    for j in range(1, image.shape[0]):
        if image[j, i] == 0:
            if (j-c) <= 9:
                image[c:j, i] = 0
            c = j
        if (image.shape[0] - c) <= 9:
            image[c:image.shape[0], i] = 0

# Display the segmented image

cv2.imshow('Segmented Image', image)
cv2.waitKey(0)
cv2.destroyAllWindows()
cv2.imwrite('segmented_image.jpg', image)