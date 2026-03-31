export const compositeMaskedImage = (
  originalBase64: string,
  generatedBase64: string,
  alphaMaskBase64: string // 사용자가 칠한 브러쉬 마스크
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const origImg = new Image();
    const genImg = new Image();
    const maskImg = new Image();

    origImg.crossOrigin = 'anonymous';
    genImg.crossOrigin = 'anonymous';
    maskImg.crossOrigin = 'anonymous';

    let loaded = 0;
    const onload = () => {
      loaded++;
      if (loaded === 3) {
        try {
          const canvas = document.createElement('canvas');
          // 🔥 프로페셔널 패치 1: 원본 이미지의 해상도(4K 등)를 최종 결과물의 기준으로 삼습니다.
          canvas.width = origImg.naturalWidth;
          canvas.height = origImg.naturalHeight;
          
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error('ctx error');

          // 1. 바탕에 원본 이미지를 100% 화질로 먼저 그립니다.
          ctx.drawImage(origImg, 0, 0, canvas.width, canvas.height);

          // 2. AI가 생성한 이미지를 처리할 임시 레이어(캔버스) 생성
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tempCtx = tempCanvas.getContext('2d');
          if (!tempCtx) throw new Error('temp ctx error');

          // AI 이미지를 임시 레이어에 그립니다. (원본 해상도에 맞춰 자동 스케일링)
          tempCtx.drawImage(genImg, 0, 0, tempCanvas.width, tempCanvas.height);

          // 3. 마스크를 이용해 AI 이미지의 경계선을 정교하게 깎아냅니다.
          tempCtx.globalCompositeOperation = 'destination-in';
          
          // 🔥 프로페셔널 패치 2: 지능형 적응형 페더링 (Adaptive Feathering)
          // 경계선을 부드럽게 하되, 물체의 선명도를 해치지 않도록 기존보다 더 정밀하게 조절합니다.
          // 기존 (width / 500) -> 개선 (width / 250)으로 더 부드러운 경계면 확보하여 '종이 인형' 느낌 제거
          const featherAmount = Math.max(5, canvas.width / 250); 
          tempCtx.filter = `blur(${featherAmount}px)`;
          
          // 마스크를 그려서 AI 이미지의 외곽선을 부드러운 반투명 상태로 만듭니다.
          tempCtx.drawImage(maskImg, 0, 0, tempCanvas.width, tempCanvas.height);
          
          // 필터 초기화
          tempCtx.filter = 'none';

          // 4. 최종 합성: 원본 위에 마스킹된 AI 레이어를 덮어씌웁니다.
          // 이 방식은 원본의 조명과 AI의 개체가 가장 자연스럽게 섞이는 방식입니다.
          ctx.drawImage(tempCanvas, 0, 0);

          // 5. 결과물을 고화질 JPEG로 출력 (용량 최적화 및 화질 보존)
          resolve(canvas.toDataURL('image/jpeg', 0.92));
        } catch (e) {
          reject(e);
        }
      }
    };

    origImg.onload = onload;
    genImg.onload = onload;
    maskImg.onload = onload;

    origImg.src = originalBase64;
    genImg.src = generatedBase64;
    maskImg.src = alphaMaskBase64;
  });
};
