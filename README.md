# ico-to-png

This is a small library for converting ico images to png, written entirely using TypeScript with only one dependency (lodepng) and based on these libraries:
- [ico-to-png](https://www.npmjs.com/package/ico-to-png)
- [decode-ico](https://www.npmjs.com/package/decode-ico)
- [decode-bmp](https://www.npmjs.com/package/decode-bmp)
- [resize-image-data](https://www.npmjs.com/package/resize-image-data)
- [to-data-view](https://www.npmjs.com/package/to-data-view)

Why did I create this library? To get around some of the bugs and complexities associated with using these libraries in the project with ES6 only imports. And also add more typescript support. It has only one dependency: lodepng.
