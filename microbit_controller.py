# Flash this file using https://python.microbit.org/
# On the micro:bit: A = confirm packed, B = placement failed / retry.
# Use a USB data cable, not a charge-only cable.
from microbit import *

display.show(Image.HAPPY)
while True:
    if button_a.was_pressed():
        print('A')
        display.show(Image.YES)
        sleep(250)
        display.show(Image.HAPPY)
    elif button_b.was_pressed():
        print('B')
        display.show(Image.NO)
        sleep(250)
        display.show(Image.HAPPY)
    sleep(40)
