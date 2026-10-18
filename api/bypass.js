export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    let targetUrl = null;

    // 1. Lấy từ req.query nếu Vercel đã parse sẵn
    if (req.query && req.query.url) {
        targetUrl = req.query.url;
    }

    // 2. Tự phân tích trực tiếp từ req.url phòng trường hợp query bị trống
    if (!targetUrl && req.url) {
        try {
            const protocol = req.headers['x-forwarded-proto'] || 'https';
            const host = req.headers.host || 'localhost';
            const fullUrl = new URL(req.url, `${protocol}://${host}`);
            targetUrl = fullUrl.searchParams.get('url');
        } catch (e) {}
    }

    // 3. Lấy từ body nếu gửi dạng POST
    if (!targetUrl && req.body && req.body.url) {
        targetUrl = req.body.url;
    }

    if (!targetUrl) {
        return res.status(400).json({ 
            success: false, 
            error: "Thiếu tham số 'url'. Vui lòng truyền URL cần bypass." 
        });
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        return res.status(400).json({ 
            success: false, 
            error: "URL không hợp lệ." 
        });
    }

    console.log(`[Bypass Engine] Đang xử lý: ${targetUrl}`);

    try {
        let finalDestination = null;
        const lowerUrl = targetUrl.toLowerCase();

        // Xử lý đặc thù cho Linkvertise
        if (lowerUrl.includes('linkvertise.com') || lowerUrl.includes('linkvertise.net')) {
            let pathSegments = new URL(targetUrl).pathname.split('/').filter(Boolean);
            let targetId = pathSegments[pathSegments.length - 1];
            
            if (targetId) {
                const apiTarget = `https://linkvertise.com/api/v1/redirect/target/kanpai/${targetId}`;
                try {
                    let resApi = await fetch(apiTarget, {
                        headers: { 
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0', 
                            'Accept': 'application/json' 
                        }
                    });
                    if (resApi.ok) {
                        let data = await resApi.json();
                        if (data && data.target) finalDestination = data.target;
                    }
                } catch (e) {}
            }
        }

        // Luồng quét chuyển hướng chung nếu chưa lấy được
        if (!finalDestination) {
            let response = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                redirect: 'follow'
            });

            finalDestination = response.url;
            let html = await response.text();

            const urlRegex = /https?:\/\/[^\s<>"]+/g;
            let matches = html.match(urlRegex);
            if (matches) {
                for (let m of matches) {
                    let clean = m.replace(/["'}>,;\\)]/g, '');
                    let lowerClean = clean.toLowerCase();
                    if (
                        clean.startsWith('http') &&
                        !lowerClean.includes('gtraffic') &&
                        !lowerClean.includes('link4m') &&
                        !lowerClean.includes('linkvertise') &&
                        !lowerClean.includes('google') &&
                        !lowerClean.includes('cloudflare') &&
                        !lowerClean.includes('w3.org')
                    ) {
                        finalDestination = clean;
                        break;
                    }
                }
            }
        }

        if (finalDestination) {
            return res.status(200).json({
                success: true,
                source: targetUrl,
                destination: finalDestination
            });
        } else {
            throw new Error("Không thể bóc tách ra được link đích.");
        }

    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            error: err.message || "Lỗi xử lý hệ thống." 
        });
    }
}
