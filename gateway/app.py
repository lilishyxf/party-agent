# WeChat Gateway — 微信公众号消息适配层
# 对应 V4 设计文档 3.2.1 用户接入层 + 4.3 数据流第 3-8 步
# 职责:
#   GET  /wechat  — 微信服务器 Token 校验
#   POST /wechat  — 接收微信消息 → 固定回复 Web 门户链接

import hashlib
import os
import time
from xml.etree import ElementTree as ET

from dotenv import load_dotenv
from fastapi import FastAPI, Query, Request, Response

load_dotenv()

WECHAT_TOKEN = os.getenv("WECHAT_TOKEN", "")
PORTAL_URL = os.getenv("PORTAL_URL", "https://your-portal-url.com")
print(f"[启动] WECHAT_TOKEN='{WECHAT_TOKEN}' PORTAL_URL='{PORTAL_URL}'")

app = FastAPI(title="WeChat Gateway for Party Affairs Agent")


def verify_signature(signature: str, timestamp: str, nonce: str) -> bool:
    tmp = sorted([WECHAT_TOKEN, timestamp, nonce])
    tmp_str = "".join(tmp)
    return signature == hashlib.sha1(tmp_str.encode()).hexdigest()


def parse_message(xml_body: str) -> dict:
    root = ET.fromstring(xml_body)
    return {child.tag: child.text or "" for child in root}


def build_text_reply(to_user: str, from_user: str, content: str) -> str:
    return (
        f"<xml>"
        f"<ToUserName><![CDATA[{to_user}]]></ToUserName>"
        f"<FromUserName><![CDATA[{from_user}]]></FromUserName>"
        f"<CreateTime>{int(time.time())}</CreateTime>"
        f"<MsgType><![CDATA[text]]></MsgType>"
        f"<Content><![CDATA[{content}]]></Content>"
        f"</xml>"
    )


@app.get("/wechat")
async def wechat_verify(
    signature: str = Query(...),
    timestamp: str = Query(...),
    nonce: str = Query(...),
    echostr: str = Query(...),
):
    if verify_signature(signature, timestamp, nonce):
        return Response(content=echostr)
    return Response(content="signature fail", status_code=403)


@app.post("/wechat")
async def wechat_message(request: Request):
    body = await request.body()
    msg = parse_message(body.decode("utf-8"))

    msg_type = msg.get("MsgType", "")
    to_user = msg.get("FromUserName", "")
    from_user = msg.get("ToUserName", "")

    if msg_type == "event" and msg.get("Event") == "subscribe":
        reply = (
            f"欢迎使用党务 AI 助手！\n\n"
            f"我是计算机学院教师第一支部的智能问答系统。\n\n"
            f"请访问以下链接使用完整功能：\n{PORTAL_URL}\n\n"
            f"如有紧急党务问题，请联系支部书记。"
        )
    else:
        reply = (
            f"点击下方链接进入党务 AI 助手门户：\n\n"
            f"{PORTAL_URL}\n\n"
            f"您可以在门户中使用智能问答、党务知识库、业务流程指引等功能。"
        )

    return Response(
        content=build_text_reply(to_user, from_user, reply),
        media_type="application/xml",
    )
