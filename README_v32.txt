ADIL ACADEMY — TRUE MOBILE FULLSCREEN v32

This update changes only the fullscreen toggle logic.
It tries true fullscreen on the video iframe first, then the outer player shell.
The same button exits fullscreen.

Important:
On some iPhone/iOS browser contexts, WebKit does not allow arbitrary webpage/iframe fullscreen.
In that case the existing CSS full-viewport fallback can fill the page, but the browser's URL/tool bars may remain visible.
No website code can force-hide browser chrome when the browser refuses native fullscreen.

No intentional changes to Resume, Q&A, Daily Limit, progress tracking, or lesson locks.
