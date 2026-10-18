export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    let targetUrl = null;

    if (req.query && req.query.url) {
        targetUrl = req.query.url;
    }

    if (!targetUrl && req.url) {
        try {
            const protocol = req.headers['x-forwarded-proto'] || 'https';
            const host = req.headers.host || 'localhost';
            const fullUrl = new URL(req.url, `${protocol}://${host}`);
            targetUrl = fullUrl.searchParams.get('url');
        } catch (e) {}
    }

    if (!targetUrl && req.body && req.body.url) {
        targetUrl = req.body.url;
    }

    if (!targetUrl) {
        return res.status(400).json({ success: false, error: "Thiếu tham số 'url'." });
    }

    console.log(`[Bypass Engine] Đang xử lý: ${targetUrl}`);

    try {
        let finalDestination = null;
        const lowerUrl = targetUrl.toLowerCase();

        // 1. Xử lý chuyên sâu cho Linkvertise
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
                        if (data && data.target && isValidDestination(data.target)) {
                            finalDestination = data.target;
                        }
                    }
                } catch (e) {}
            }
        }

        // 2. Nếu chưa có, tiến hành fetch và quét HTML thông minh loại bỏ rác
        if (!finalDestination) {
            let response = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                redirect: 'follow'
            });

            if (response.url && isValidDestination(response.url) && response.url !== targetUrl) {
                finalDestination = response.url;
            } else {
                let html = await response.text();
                const urlRegex = /https?:\/\/[^\s<>"]+/g;
                let matches = html.match(urlRegex);
                
                if (matches) {
                    for (let m of matches) {
                        let clean = m.replace(/["'}>,;\\)]/g, '');
                        if (isValidDestination(clean)) {
                            finalDestination = clean;
                            break;
                        }
                    }
                }
            }
        }

        if (finalDestination && isValidDestination(finalDestination)) {
            return res.status(200).json({
                success: true,
                source: targetUrl,
                destination: finalDestination
            });
        } else {
            throw new Error("Không thể trích xuất được link đích hợp lệ.");
        }

    } catch (err) {
        return res.status(500).json({ 
            success: false, 
            error: err.message || "Lỗi xử lý hệ thống." 
        });
    }
}

/**
 * Hàm kiểm tra và lọc bỏ các link rác, CDN, font, hình ảnh, script
 */
function isValidDestination(urlStr) {
    try {
        let u = new URL(urlStr);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
        
        let href = u.href.toLowerCase();
        let hostname = u.hostname.toLowerCase();

        // Danh sách tên miền hệ thống / CDN / Font / MXH cần chặn tuyệt đối
        const blacklistedDomains = [
            'gstatic.com', 'googleapis.com', 'google.com', 'cloudflare.com',
            'w3.org', 'schema.org', 'jsdelivr.net', 'cdnjs.cloudflare.com',
            'linkvertise.com', 'linkvertise.net', 'link4m.com', 'gtraffic.io',
            'lootlabs.gg', 'facebook.com', 'twitter.com', 'telegram.org', 'discord.com'
        ];

        for (let d of blacklistedDomains) {
            if (hostname.includes(d)) return false;
        }

        // Chặn các đuôi tệp tin tài nguyên (hình ảnh, stylesheet, font, script)
        const ignoredExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.ico', '.svg', '.woff', '.woff2', '.webp', '.json'];
        for (let ext of ignoredExtensions) {
            if (href.endsWith(ext) || href.includes(ext + '?')) return false;
        }

        return true;
    } catch (e) {
        return false;
    }
}
