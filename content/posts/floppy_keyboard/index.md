+++
title = 'Assembling the Floppy keyboard'
date = 2024-11-12T21:16:00+02:00
tags = ['qmk']
categories = ['diy', 'keyboard']
image = '/IMG_1814.jpeg'
+++

A few weeks ago, I was feeling like making a new (split) keyboard, since I hadn't assembled one for nearly a year now. It's like Lego(tm), so of course I love that activity as much as coding, and since I'm on a keyboard 10 hours a day due to my job and hobbies, it's quite fitting.

This time, my crazy idea was to fit a split keyboard in the footprint of a floppy disk. 90mm x 94mm. One per hand, because I'm not crazy!

![The PCBS](/IMG_1790.jpeg)

## Components required

- a PCB kit (2x backplates, 2x PCBs, 2x switch plate),
- 2x pro-micro compatible controllers (I'll be using Liatris in this guide),
- (optional) 2x set of two mill max sockets with headers (only if you want your controllers to be hotswappable),
- 2x RJ9 connectors,
- 34x surface mounted diodes (1N4148W),
- 34x Kailh choc hotswap sockets (PG1350),
- 34x choc v1 switches,
- 34x choc v1 keycaps,
- 4x M2 spacers and 8x M2 screws (preferably 4mm),
- a **straight** RJ9 cable (you can make them straight with a crimping tool),
- some little rubber feet/bumpers (minimum of 4 on each side)

As of November 2024, this will tally at approximately 130€.

## Build guide

A short build guide with various tips and tricks I learned from building a few keyboards will now interrupt this article.

### Soldering the MCU jumpers

> [!NOTE]
> They are used to select the orientation / side the MCU is on, on reversible designs such as this one. Each controller has a top side and a bottom side. The top will have its chip and most other components on it, while the bottom is usually bare (and will often have a logo or other graphic on it).

Since I use a [Liatris](https://splitkb.com/products/liatris), its back having the reset button and LEDs should face toward me. The jumpers to solder will then be **on the same side as the controller**.

![Bottom side (source: splitkb.com)](/SKB-CON-LTR-010-pic-back_732x488.webp) ![Top side (source: splitkb.com)](/SKB-CON-LTR-010-pic-front_732x488.webp)

If you want to have the top side of your controller toward you, solder the jumpers **on the back of the PCB, the side with the sockets**.

I made the mistake of soldering them on the back of the PCB and wondering why the keys didn't register anything... Luckily, it's an easy fix, and it causes no damage to the MCU (unless you plug-in the TRRS cable, which carries VCC and GND ; you wouldn't want that on the wrong pins).

![Soldered jumpers](/IMG_1791.png)

### Soldering hotswap sockets

This keyboard is hotswap only, meaning we have to use PG1350 Kailh choc hotswap sockets. To solder them more easily, I pre-tin one side of each pad, and then plave the sockets.

![Tinned pad and placing sockets](/IMG_1792.jpeg)

Then I heat up the solder, while using tweezers to keep the socket in place. Repeat 16 more times for the other sockets, and **don't forget to solder the other pad** for every socket too!

![Soldered sockets](/IMG_1793.jpeg)

### Diodes

In order to have _NKRO_ (N-Key rollover, being able to press N different keys at once and have them all being registered), we have to solder diodes. For this keyboard, I choose surface mounted ones, because I already had some spare, and even though they are small, they are still easy to solder.

To make them easier to solder, I apply the same method as for soldering the sockets, and pre-tin one side:

![Tinning one side of the diode pads](/IMG_1795.jpeg)

> [!CAUTION]
> The diodes **must** be oriented with the line facing the diode symbol line on the PCB (same side as the pad surrounded by a rectangle).

![Soldered diodes](/IMG_1797.jpeg)

### MCU sockets (optional)

> [!NOTE]
> This step is only required if you don't want to solder your MCU to the board, to be able to reuse it.

To solder the sockets, I triple check that I'm putting them on the switches side, then insert them and tape them with electrical tape, so that I can flip the board and start soldering.

![Taped sockets. On this picture, the jumpers aren't soldered yet.](/IMG_1798.jpeg)

Then, I solder each end of the sockets, flip the PCB and ensure that the sockets are straight and not leaning on the side.

> [!NOTE]
> If they're leaning on the side, I heat up one end and gently push the sockets, then do the same with the other end.

### RJ9 connector

Finally, we can solder the RJ9 connector. I used [this connector](https://fr.aliexpress.com/item/1005003078110991.html) from AliExpress, see the graphic for the specific dimensions.

> [!CAUTION]
> A 6P6C connector won't work as the dimensions are different.
>
> You will also require a **straight** 4P4C / RJ9 cable. If you use a **reverse** 4P4C / RJ9 cable you **will** end up frying your controller by putting VCC to GND, GND to data and VCC and data to GND.
>
> If you have a reverse 4P4C / RJ9 cable, you can cut one end and use a crimping tool to put a new connector on the correct orientation to get a straight cable.

It will be on the same side as the switches:

![Connector schema](/4p4c_connector.png) ![Desired cable pinout](/straight_rj9.png) ![Soldered RJ9 connector](/IMG_1800.jpeg)

## Firmware

I have created a small QMK firmware, with [Vial](https://get.vial.today/) support, that's uploaded to the repo of the keyboard: [SuperFola/floppy - firmware](https://github.com/SuperFola/floppy/tree/master/firmware).

All you to do is copy the `firmware/` folder under your `qmk/keyboards/` folder (or `vial-qmk/keyboards/`), compile and flash it.

With Vial, it's as easy as `make floppy:vial:flash`.

## Ordering

Get the gerbers on the GitHub repository: [SuperFola/floppy - gerbers](https://github.com/SuperFola/floppy/tree/master/gerbers).

I choose 1.2mm thickness for the backplate and top plate, and 1.6mm for the PCB itself. I had planned to have the order number hidden under the MCU on the footprint with the magic text "JLCJLCJLCJLC" that JLCPCB can use and replace with the reference, and have it not be on the back and top plates... Alas, I forgot this setting while ordering, so be careful with that too!

> [!IMPORTANT]
> Since the keyboard fits under the 10cm x 10cm, it is very cheap to get printed on services like JLCPCB and PCBWay (I paid around 10€ for 5 PCBS, 5 backplates, 5 top plates, in October 2024).

## Final build

And here are the final results (I went with pastel choc keycaps for a somewhat vintage look):

![Left hand side](/IMG_1802.jpeg) ![Left hand side, right hand flipped to see its back](/IMG_1805.jpeg)

![Side to side](/IMG_1804.jpeg) ![With a floppy disk between them for comparison](/IMG_1806.jpeg)

![With a cable](/IMG_1814.jpeg)

