import {
  useApi,
  useTranslate,
  reactExtension,
  BlockStack,
  Checkbox,
  InlineLayout,
  Image,
  Text,
  Pressable,
  Heading,
  BlockSpacer,
  Divider,
  useCartLines,
  useSettings,
  useApplyCartLinesChange,
} from "@shopify/ui-extensions-react/checkout";

import { useEffect, useState } from "react";

export default reactExtension("purchase.checkout.cart-line-list.render-after", () => <Extension />);

// INTERFACES
interface ProductMetafieldsData {
  product: {
    metafields: {
      type: string;
      key: string;
      value: string;
    }[];
  };
}

interface VariantData {
  title: string;
  featuredImage: {
    altText: string;
    id: string;
    originalSrc: string;
  };
  variants: {
    edges: [
      {
        node: {
          id: string;
          sku: string;
          title: string;
          priceV2: {
            amount: string;
            currencyCode: string;
          };
          image: {
            url: string;
            altText: string | null;
          };
        };
      }
    ];
  };
}

// EXTENSIONS FUNCTION
function Extension() {
  // destructuring the query function from the useApi hook
  const { query } = useApi();

  // setting up the state for the variant data
  const [variantData, setVariantData] = useState<null | VariantData>(null);
  // setting up the state for the fetched variant ID
  const [fetchedVariantID, setFetchedVariantID] = useState<null | string>(null);
  // setting up the state for the recc product ID
  const [reccProductId, setReccProductId] = useState<null | string[]>(null);
  // setting up the state for the checkbox
  const [isSelected, setIsSelected] = useState(false);

  // getting the cart lines and the applyCartLinesChange function from the useCartLines and useApplyCartLinesChange hooks
  const cartLines = useCartLines();
  // getting the applyCartLinesChange function from the useApplyCartLinesChange hook
  const applyCartLinesChange = useApplyCartLinesChange();

  // getting the settings from the useSettings hook
  const settings = useSettings();

  // getting the title from the settings
  const title = settings.upsell_title as string;

  // setting up the fallback variant ID
  let fallbackUpsellVariantID = settings.selected_fallback_variant as string;
  // setting up the default variant ID
  const variantIDDefault = "gid://shopify/Product/8992711246105";

  // if the fallback variant ID is not set, set it to the default variant ID
  if (!fallbackUpsellVariantID) {
    fallbackUpsellVariantID = variantIDDefault;
  }

  // getting the last added line item from the cart lines
  const lastAddedLineItem = cartLines[cartLines.length - 1];
  // getting the variant ID from the last added line item
  const variantID = lastAddedLineItem.merchandise.id;

  useEffect(() => {
    // fetching the last line item data in order to get recc product ID from metafields and set it to the state
    async function getLineItemData() {
      const lineItemData = await query<{ node: ProductMetafieldsData }>(`{
                node(id: "${variantID}"){
                  ... on ProductVariant {
                    product {
                      metafields(identifiers: [{namespace: "shopify--discovery--product_recommendation", key: "complementary_products"}]) {
                        type
                        key
                        value
                      }
                    }
                  }
                }
              }`);

      // if the line item data is not null, set the recc product ID to the state
      if (lineItemData?.data?.node) {
        const reccProductId = lineItemData?.data?.node?.product?.metafields[0]?.value;
        let parsedIds;
        if (reccProductId) {
          parsedIds = JSON.parse(reccProductId);
        }
        // if the recc product ID is not null, set the recc product ID to the state else set the fallback variant ID to the state
        if (reccProductId) {
          setReccProductId(parsedIds[0]);
        } else {
          setReccProductId([fallbackUpsellVariantID]);
        }
      }
    }

    // function call
    getLineItemData();
  }, []);

  useEffect(() => {
    // fetching the variant data from the recc product ID and set it to the state
    async function getVariantData() {
      const variantData = await query<{ product: VariantData }>(`{
                product(id: "${reccProductId}"){
                    title
                    featuredImage {
                        altText
                        id
                        originalSrc
                    }
                    variants(first: 1) {
                            edges {
                            node {
                                id
                                sku
                                title
                                priceV2 {
                                  amount
                                  currencyCode
                                }
                                image {
                                    url
                                    altText
                                }
                            }
                        }
                    }
                }

              }`);
      if (variantData) {
        setVariantData(variantData?.data?.product);
        setFetchedVariantID(variantData?.data?.product?.variants?.edges[0]?.node?.id);
      }
    }

    if (reccProductId) {
      getVariantData();
    }
  }, [reccProductId]);

  // ading the variant to the cart if the checkbox is checked and removing it if it is unchecked
  useEffect(() => {
    if (!fetchedVariantID) return;
    if (isSelected) {
      applyCartLinesChange({
        type: "addCartLine",
        merchandiseId: fetchedVariantID,
        quantity: 1,
      });
    } else {
      const cartLineId = cartLines.find((cartLine) => cartLine?.merchandise?.id === variantID)?.id;

      if (cartLineId) {
        applyCartLinesChange({
          type: "removeCartLine",
          id: cartLineId,
          quantity: 1,
        });
      }
    }
  }, [isSelected]);

  // if the variant data is null, return null
  if (!variantData) {
    return null;
  }

  return (
    <>
      <Divider />
      <BlockSpacer spacing={"base"} />
      <Heading level={2}>{title ? title : "You may also Like"}</Heading>
      <BlockSpacer spacing={"base"} />
      <Pressable onPress={() => setIsSelected(!isSelected)}>
        <InlineLayout
          blockAlignment={"center"}
          spacing={["base", "base"]}
          columns={["auto", 80, "fill"]}
          padding={"base"}
        >
          <Checkbox checked={isSelected} />
          <Image
            source={variantData?.variants?.edges[0]?.node?.image?.url || variantData?.featuredImage?.originalSrc}
            accessibilityDescription={
              variantData?.variants?.edges[0]?.node?.image?.altText || variantData?.featuredImage?.altText
            }
            border={"base"}
            borderRadius={"base"}
            borderWidth={"base"}
          />
          <BlockStack spacing="none">
            <Text>{variantData?.title}</Text>
            <Text size={"small"}>- {variantData?.variants?.edges[0]?.node?.title}</Text>
            <BlockSpacer spacing={"tight"} />
            <Text>
              {variantData?.variants?.edges[0]?.node?.priceV2?.amount}{" "}
              {variantData?.variants?.edges[0]?.node?.priceV2?.currencyCode}
            </Text>
          </BlockStack>
        </InlineLayout>
      </Pressable>
    </>
  );
}
