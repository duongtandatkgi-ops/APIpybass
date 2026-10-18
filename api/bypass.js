/**
 * ============================================================================
 * ULTIMATE BYPASS BACKEND ENGINE - VERCEL SERVERLESS FUNCTION
 * Tác giả: Tối ưu hóa chuyên sâu cho Linkvertise, Link4m, Gtraffic, LootLabs
 * Phiên bản: 3.5.0 Pro Enterprise
 * ============================================================================
 */

export default async function handler(req, res) {
    // Cấu hình CORS toàn diện cho phép mọi Extension hoặc Client gọi đến
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const targetUrl = req.query.url || (req.body && req.body.url);
    
    if (!targetUrl) {
        return res.status(400).json({ 
            success: false, 
            error: "Thiếu tham số 'url'. Vui lòng truyền URL cần bypass qua query string (?url=...)" 
        });
    }

    // Kiểm tra định dạng URL cơ bản
    if (!isValidHttpUrl(targetUrl)) {
        return res.status(400).json({ 
            success: false, 
            error: "URL không hợp lệ hoặc không bắt đầu bằng giao thức HTTP/HTTPS." 
        });
    }

    console.log(`[Engine v3.5] Bắt đầu xử lý yêu cầu bypass cho URL: ${targetUrl}`);

    try {
        let finalDestination = null;
        const lowerUrl = targetUrl.toLowerCase();

        // Phân loại luồng xử lý dựa trên tên miền mục tiêu
        if (lowerUrl.includes('linkvertise.com') || lowerUrl.includes('linkvertise.net')) {
            finalDestination = await handleLinkvertiseBypass(targetUrl);
        } else if (lowerUrl.includes('gtraffic') || lowerUrl.includes('link4m') || lowerUrl.includes('l4m.co')) {
            finalDestination = await handleTokenFormBypass(targetUrl);
        } else if (lowerUrl.includes('lootlabs.gg') || lowerUrl.includes('loot-link.com')) {
            finalDestination = await handleLootLabsBypass(targetUrl);
        } else {
            // Luồng thông minh tổng quát cho các loại link khác
            finalDestination = await handleGenericSmartBypass(targetUrl);
        }

        if (finalDestination && isValidHttpUrl(finalDestination)) {
            console.log(`[Engine v3.5] Thành công! Link đích: ${finalDestination}`);
            return res.status(200).json({
                success: true,
                source: targetUrl,
                destination: finalDestination,
                timestamp: new Date().toISOString()
            });
        } else {
            throw new Error("Không thể trích xuất được đường dẫn đích cuối cùng.");
        }

    } catch (err) {
        console.error(`[Engine v3.5] Lỗi xử lý:`, err.message);
        return res.status(500).json({ 
            success: false, 
            source: targetUrl,
            error: err.message || "Lỗi hệ thống nội bộ khi thực hiện bypass." 
        });
    }
}

/**
 * ============================================================================
 * CÁC HÀM TIỆN ÍCH HỆ THỐNG & BỘ LỌC RÁC
 * ============================================================================
 */

// Danh sách đen các tên miền hệ thống, thư viện, SVG hoặc MXH cần loại bỏ tuyệt đối
const BLACKLIST_DOMAINS = [
    'w3.org',
    'schema.org',
    'google.com',
    'googleapis.com',
    'gstatic.com',
    'cloudflare.com',
    'tailwindcss.com',
    'jquery.com',
    'bootstrap',
    'jsdelivr',
    'cdnjs',
    'facebook.com',
    'twitter.com',
    'telegram.org',
    'discord.com',
    'gtraffic.io',
    'link4m.com',
    'l4m.co',
    'linkvertise.com',
    'lootlabs.gg'
];

/**
 * Kiểm tra xem một URL có thực sự hợp lệ, an toàn và không nằm trong blacklist hay không
 */
function isValidHttpUrl(string) {
    try {
        let url = new URL(string);
        if (url.protocol !== "http:" && url.protocol !== "https:") return false;
        // Chống các chuỗi chứa ký tự mã hóa CSS hoặc selector rác
        if (/[\*\{\}\[\]\s,;]/.test(url.href)) return false;
        
        let hostname = url.hostname.toLowerCase();
        for (let domain of BLACKLIST_DOMAINS) {
            if (hostname.includes(domain)) {
                return false;
            }
        }
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Tạo tập hợp User-Agent giả lập trình duyệt thật để tránh bị hệ thống Anti-bot chặn
 */
function getRandomHeaders(targetUrl = '') {
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        ...(targetUrl ? { 'Referer': targetUrl } : {})
    };
}

/**
 * Quét toàn bộ nội dung HTML để tìm kiếm các đường dẫn HTTP/HTTPS hợp lệ vượt qua bộ lọc
 */
function extractCleanUrlFromText(text) {
    if (!text) return null;
    
    // Thử phân tích JSON trước nếu văn bản là cấu trúc JSON
    try {
        const jsonData = JSON.parse(text);
        const possibleKeys = ['url', 'link', 'destination', 'target', 'data', 'redirect', 'out'];
        for (let key of possibleKeys) {
            if (jsonData[key] && typeof jsonData[key] === 'string' && isValidHttpUrl(jsonData[key])) {
                return jsonData[key];
            }
        }
    } catch (e) {}

    // Quét bằng biểu thức chính quy (Regex)
    const urlRegex = /https?:\/\/[^\s<>"]+/g;
    const matches = text.match(urlRegex);
    if (matches) {
        for (let m of matches) {
            let clean = m.replace(/["'}>,;\\)]/g, '');
            if (isValidHttpUrl(clean)) {
                return clean;
            }
        }
    }
    return null;
}

/**
 * ============================================================================
 * CÁC MÔ-ĐUN XỬ LÝ CHUYÊN BIỆT THEO TỪNG LOẠI LINK
 * ============================================================================
 */

/**
 * 1. Mô-đun xử lý Linkvertise
 */
async function handleLinkvertiseBypass(targetUrl) {
    console.log("[Module] Đang xử lý Linkvertise...");
    
    // Trích xuất mã ID từ link Linkvertise
    let pathSegments = new URL(targetUrl).pathname.split('/').filter(Boolean);
    let targetId = pathSegments[pathSegments.length - 1];
    
    if (!targetId) throw new Error("Không thể xác định ID của Linkvertise.");

    // Gọi API ngầm định dạng JSON mà Linkvertise hay sử dụng nội bộ
    const apiTarget = `https://linkvertise.com/api/v1/redirect/target/kanpai/${targetId}`;
    
    try {
        let res = await fetch(apiTarget, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0',
                'Accept': 'application/json',
                'Referer': targetUrl
            }
        });

        if (res.ok) {
            let data = await res.json();
            if (data && data.target) {
                return data.target;
            }
        }
    } catch (e) {
        console.log("[Module] API Linkvertise trực tiếp thất bại, chuyển sang phương án quét HTML dự phòng.");
    }

    // Phương án dự phòng: Fetch trang chính và quét token
    let fallbackRes = await fetch(targetUrl, { headers: getRandomHeaders(targetUrl), redirect: 'follow' });
    let html = await fallbackRes.text();
    return extractCleanUrlFromText(html) || fallbackRes.url;
}

/**
 * 2. Mô-đun xử lý Gtraffic, Link4m và các trang dùng Form Token
 */
async function handleTokenFormBypass(targetUrl) {
    console.log("[Module] Đang xử lý Gtraffic / Link4m Form Token...");
    
    // Bước 1: Lấy HTML và cookie phiên ban đầu
    let res1 = await fetch(targetUrl, {
        method: 'GET',
        headers: getRandomHeaders()
    });
    
    let html1 = await res1.text();
    
    // Bóc tách toàn bộ thẻ input ẩn chứa token xác thực
    let formData = new URLSearchParams();
    let inputRegex = /<input[^>]+name=["']([^"']+)["'][^>]+value=["']([^"']*)["']/g;
    let match;
    while ((match = inputRegex.exec(html1)) !== null) {
        formData.append(match[1], match[2]);
    }

    let inputRegex2 = /<input[^>]+value=["']([^"']*)["'][^>]+name=["']([^"']+)["']/g;
    while ((match = inputRegex2.exec(html1)) !== null) {
        formData.append(match[2], match[1]);
    }

    // Giả lập thời gian chờ đếm ngược hệ thống (3.5 giây)
    await new Promise(resolve => setTimeout(resolve, 3500));

    // Bước 2: Gửi POST request kèm Token để ép server nhả link
    let res2 = await fetch(targetUrl, {
        method: 'POST',
        headers: {
            ...getRandomHeaders(targetUrl),
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData.toString()
    });

    let text2 = await res2.text();
    let extracted = extractCleanUrlFromText(text2);
    
    if (extracted) return extracted;
    if (res2.url && res2.url !== targetUrl && isValidHttpUrl(res2.url)) return res2.url;

    throw new Error("Không thể hoàn tất xác thực Token cho trang này.");
}

/**
 * 3. Mô-đun xử lý LootLabs
 */
async function handleLootLabsBypass(targetUrl) {
    console.log("[Module] Đang xử lý LootLabs...");
    let response = await fetch(targetUrl, { headers: getRandomHeaders(targetUrl), redirect: 'follow' });
    let html = await response.text();
    
    // Thử tìm kiếm các tham số chuyển hướng ẩn dạng Base64 hoặc JSON bên trong script
    let cleanUrl = extractCleanUrlFromText(html);
    if (cleanUrl) return cleanUrl;

    return response.url;
}

/**
 * 4. Mô-đun thông minh tổng quát (Generic Smart Bypass)
 */
async function handleGenericSmartBypass(targetUrl) {
    console.log("[Module] Đang chạy luồng tổng quát thông minh...");
    
    let currentUrl = targetUrl;
    let response = await fetch(currentUrl, {
        method: 'GET',
        headers: getRandomHeaders(),
        redirect: 'follow'
    });

    // Nếu trình duyệt/server tự động chuyển hướng qua HTTP Header Location
    if (response.url && response.url !== currentUrl && isValidHttpUrl(response.url)) {
        return response.url;
    }

    let html = await response.text();

    // Kiểm tra thẻ meta refresh hoặc script chuyển hướng
    const metaRefreshMatch = html.exec ? html.match(/content=["']\d+;\s*url=([^"']+)["']/i) : null;
    if (metaRefreshMatch && metaRefreshMatch[1] && isValidHttpUrl(metaRefreshMatch[1])) {
        return metaRefreshMatch[1];
    }

    // Quét toàn bộ nội dung HTML tìm link sạch đầu tiên
    let cleanLink = extractCleanUrlFromText(html);
    if (cleanLink) {
        return cleanLink;
    }

    return currentUrl;
}

/**
 * ============================================================================
 * KẾT THÚC MÃ NGUỒN HỆ THỐNG BYPASS BACKEND
 * ============================================================================
 */
